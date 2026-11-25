import { expect, test } from "bun:test"

import type { GeminiResponseContext } from "~/lib/responses/gemini-types"

import { translateGeminiRequest } from "~/lib/responses/gemini-request"
import { translateGeminiResponse } from "~/lib/responses/gemini-response"

type JsonObject = Record<string, unknown>
const encoder = new TextEncoder()

interface TestReader {
  read(): Promise<{ done?: boolean; value?: Uint8Array }>
  cancel(reason?: unknown): Promise<void>
}

function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error("Expected a value")
  return value
}

function readerFor(response: Response): TestReader {
  return required(response.body).getReader() as TestReader
}

function context(stream = true): GeminiResponseContext {
  return { model: "gemini-4-carbon", stream, tools: {}, responseFields: {} }
}

function frame(delta: JsonObject, finishReason: string | null = null): string {
  return `data: ${JSON.stringify({ choices: [{ index: 0, delta, finish_reason: finishReason }] })}\n\n`
}

function sse(text: string): Response {
  return new Response(text, {
    headers: {
      "content-type": "text/event-stream",
      "x-request-id": "synthetic-request",
    },
  })
}

function events(text: string): Array<JsonObject> {
  return text
    .split("\n\n")
    .filter(Boolean)
    .map((event) => JSON.parse(event.split("\ndata: ")[1]) as JsonObject)
}

async function one(reader: {
  read(): Promise<{ done?: boolean; value?: Uint8Array }>
}): Promise<JsonObject> {
  const chunk = await reader.read()
  expect(chunk.done).toBe(false)
  return events(new TextDecoder().decode(chunk.value))[0]
}

function completed(all: Array<JsonObject>): JsonObject {
  return all.at(-1)?.response as JsonObject
}

test("streams text before upstream finishes and keeps lifecycle IDs and sequence stable", async () => {
  let source!: ReadableStreamDefaultController<Uint8Array>
  const upstream = new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        source = controller
      },
    }),
    { headers: { "content-type": "text/event-stream" } },
  )
  const response = await translateGeminiResponse(upstream, context())
  const reader = readerFor(response)
  source.enqueue(encoder.encode(frame({ content: "Hel" })))
  const observed: Array<JsonObject> = []
  while (observed.at(-1)?.type !== "response.output_text.delta")
    observed.push(await one(reader))
  expect(observed.at(-1)?.delta).toBe("Hel")
  source.enqueue(
    encoder.encode(frame({ content: "lo" }, "stop") + "data: [DONE]\n\n"),
  )
  source.close()
  while (true) {
    const chunk = await reader.read()
    if (chunk.done) break
    observed.push(...events(new TextDecoder().decode(chunk.value)))
  }
  expect(observed.map((event) => event.sequence_number)).toEqual(
    observed.map((_, index) => index),
  )
  expect(observed.map((event) => event.type)).toEqual([
    "response.created",
    "response.in_progress",
    "response.output_item.added",
    "response.content_part.added",
    "response.output_text.delta",
    "response.output_text.delta",
    "response.output_text.done",
    "response.content_part.done",
    "response.output_item.done",
    "response.completed",
  ])
  const final = completed(observed)
  expect(final.status).toBe("completed")
  const output = final.output as Array<JsonObject>
  expect((output[0].content as Array<JsonObject>)[0].text).toBe("Hello")
  const added = required(
    observed.find((event) => event.type === "response.output_item.added"),
  ).item as JsonObject
  expect(output[0].id).toBe(added.id)
  expect((observed[0].response as JsonObject).id).toBe(final.id)
})

test("maps parallel argument fragments and replays assistant opaque metadata through a carrier", async () => {
  const definitions = ["first", "second"].map((name) => ({
    type: "function",
    name,
    parameters: { type: "object" },
  }))
  const initial = translateGeminiRequest(
    JSON.stringify({
      model: "gemini-4-carbon",
      input: "Use tools",
      tools: definitions,
      stream: true,
    }),
  )
  const names = Object.keys(initial.context.tools)
  const text =
    frame({
      reasoning_opaque: "opaque-",
      reasoning_content: "private ",
      tool_calls: [
        {
          index: 0,
          id: "call_first",
          type: "function",
          function: { name: names[0], arguments: '{"x":' },
        },
        {
          index: 1,
          id: "call_second",
          type: "function",
          function: { name: names[1], arguments: '{"y":' },
        },
      ],
    })
    + frame(
      {
        reasoning_opaque: "tail",
        reasoning_content: "reasoning",
        tool_calls: [
          { index: 1, function: { arguments: "2}" } },
          { index: 0, function: { arguments: "1}" } },
        ],
      },
      "tool_calls",
    )
    + "data: [DONE]\n\n"
  const response = await translateGeminiResponse(sse(text), initial.context)
  const observed = events(await response.text())
  const output = completed(observed).output as Array<JsonObject>
  const calls = output.filter((item) => item.type === "function_call")
  expect(calls.map((item) => [item.name, item.arguments])).toEqual([
    ["first", '{"x":1}'],
    ["second", '{"y":2}'],
  ])
  expect(
    observed
      .filter((item) => item.type === "response.function_call_arguments.delta")
      .map((item) => item.delta),
  ).toEqual(['{"x":', '{"y":', "2}", "1}"])
  const replay = translateGeminiRequest(
    JSON.stringify({
      model: "gemini-4-carbon",
      tools: definitions,
      input: [
        ...output,
        ...calls.map((call) => ({
          type: "function_call_output",
          call_id: call.call_id,
          output: "OK",
        })),
      ],
    }),
  )
  const messages = replay.payload.messages as Array<JsonObject>
  const assistant = required(
    messages.find((message) => message.role === "assistant"),
  )
  expect(assistant.reasoning_opaque).toBe("opaque-tail")
  expect(assistant.reasoning_content).toBe("private reasoning")
  expect(
    output
      .filter((item) => item.type === "reasoning")
      .every((item) => (item.summary as Array<unknown>).length === 0),
  ).toBe(true)
  expect(
    (assistant.tool_calls as Array<JsonObject>).map((call) => call.id),
  ).toEqual(["call_first", "call_second"])
  expect(messages.filter((message) => message.role === "tool")).toHaveLength(2)
})

test("does not report upstream errors or premature EOF as successful completion", async () => {
  for (const raw of [
    frame({ content: "partial" }),
    frame({ content: "partial" }, "stop"),
    'data: {"error":{"message":"failed"}}\n\n',
    "data: malformed\n\n",
  ]) {
    const response = await translateGeminiResponse(sse(raw), context())
    const observed = events(await response.text())
    expect(observed.at(-1)?.type).toBe("response.failed")
    expect(completed(observed).status).toBe("failed")
    expect(observed.some((event) => event.type === "response.completed")).toBe(
      false,
    )
  }
})

test("restores namespaces and incrementally unwraps custom input across escaped characters", async () => {
  const initial = translateGeminiRequest(
    JSON.stringify({
      model: "gemini-4-carbon",
      input: "Use tools",
      stream: true,
      tools: [
        {
          type: "namespace",
          name: "shell",
          tools: [{ type: "function", name: "run" }],
        },
        { type: "custom", name: "patch", format: { type: "text" } },
      ],
    }),
  )
  const [fn, custom] = Object.keys(initial.context.tools)
  const input = 'line\n"quoted" \\ 😀'
  const argumentsText = JSON.stringify({ input })
  let raw = frame({
    tool_calls: [
      {
        index: 0,
        id: "fn-1",
        type: "function",
        function: { name: fn, arguments: "{}" },
      },
    ],
  })
  raw += frame({
    tool_calls: [
      {
        index: 1,
        id: "custom-1",
        type: "function",
        function: { name: custom, arguments: "" },
      },
    ],
  })
  for (const character of argumentsText)
    raw += frame({
      tool_calls: [{ index: 1, function: { arguments: character } }],
    })
  raw += frame({}, "tool_calls") + "data: [DONE]\n\n"
  const bytes = encoder.encode(raw.replaceAll("\n", "\r\n"))
  let offset = 0
  const upstream = new Response(
    new ReadableStream<Uint8Array>({
      pull(controller) {
        if (offset < bytes.length)
          controller.enqueue(bytes.slice(offset, ++offset))
        else controller.close()
      },
    }),
    { headers: { "content-type": "text/event-stream; charset=utf-8" } },
  )
  const observed = events(
    await (await translateGeminiResponse(upstream, initial.context)).text(),
  )
  expect(completed(observed).status).toBe("completed")
  const output = completed(observed).output as Array<JsonObject>
  expect(output[0]).toMatchObject({
    type: "function_call",
    namespace: "shell",
    name: "run",
    arguments: "{}",
  })
  expect(output[1]).toMatchObject({
    type: "custom_tool_call",
    name: "patch",
    input,
  })
  expect(
    observed
      .filter((event) => event.type === "response.custom_tool_call_input.delta")
      .map((event) => event.delta)
      .join(""),
  ).toBe(input)
  const added = required(
    observed.find(
      (event) =>
        event.type === "response.output_item.added"
        && (event.item as JsonObject).type === "custom_tool_call",
    ),
  ).item as JsonObject
  expect(added).not.toHaveProperty("arguments")
  expect(output[1]).not.toHaveProperty("arguments")
})

test("maps token limits, filtering and explicit refusal to incomplete Responses", async () => {
  const cases: Array<[JsonObject, string, string]> = [
    [{ content: "partial" }, "length", "max_output_tokens"],
    [{ content: null }, "content_filter", "content_filter"],
    [
      { content: null, reasoning_opaque: "private-state" },
      "length",
      "max_output_tokens",
    ],
    [
      {
        content: null,
        reasoning_content: "private reasoning",
        reasoning_opaque: "private-state",
      },
      "content_filter",
      "content_filter",
    ],
    [{ refusal: "Cannot comply." }, "stop", "content_filter"],
  ]
  for (const [delta, finish, reason] of cases) {
    const observed = events(
      await (
        await translateGeminiResponse(
          sse(frame(delta, finish) + "data: [DONE]\n\n"),
          context(),
        )
      ).text(),
    )
    expect(observed.at(-1)?.type).toBe("response.incomplete")
    expect(completed(observed)).toMatchObject({
      status: "incomplete",
      incomplete_details: { reason },
    })
    expect(observed.some((event) => event.type === "response.completed")).toBe(
      false,
    )
  }
})

test("keeps metadata-only filtered or limited JSON responses incomplete without unbound carriers", async () => {
  for (const finish of ["length", "content_filter"]) {
    const upstream = Response.json({
      choices: [
        {
          index: 0,
          message: {
            content: null,
            reasoning_opaque: "private-state",
            reasoning_content: "private reasoning",
          },
          finish_reason: finish,
        },
      ],
    })
    const response = await translateGeminiResponse(upstream, context(false))
    expect(await response.json()).toMatchObject({
      status: "incomplete",
      output: [],
      error: null,
    })
  }
})

test("preserves usage and request ID while removing invalidated transfer headers", async () => {
  const response = await translateGeminiResponse(
    new Response(
      JSON.stringify({
        choices: [
          { index: 0, message: { content: "OK" }, finish_reason: "stop" },
        ],
        usage: {
          prompt_tokens: 80,
          completion_tokens: 20,
          total_tokens: 100,
          prompt_tokens_details: { cached_tokens: 30 },
          reasoning_tokens: 12,
        },
      }),
      {
        headers: {
          "content-type": "application/json",
          "content-length": "9999",
          "content-encoding": "gzip",
          "x-request-id": "synthetic-request",
        },
      },
    ),
    context(false),
  )
  expect(response.headers.get("x-request-id")).toBe("synthetic-request")
  expect(response.headers.get("content-length")).toBeNull()
  expect(response.headers.get("content-encoding")).toBeNull()
  const body = (await response.json()) as JsonObject
  expect(body.usage).toEqual({
    input_tokens: 80,
    input_tokens_details: { cached_tokens: 30 },
    output_tokens: 20,
    output_tokens_details: { reasoning_tokens: 12 },
    total_tokens: 100,
  })
  const withUsage =
    frame({ content: "OK" }, "stop")
    + `data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 2, completion_tokens: 3, completion_tokens_details: { reasoning_tokens: 1 } } })}\n\n`
    + "data: [DONE]\n\n"
  expect(
    completed(
      events(
        await (await translateGeminiResponse(sse(withUsage), context())).text(),
      ),
    ).usage,
  ).toMatchObject({
    total_tokens: 5,
    output_tokens_details: { reasoning_tokens: 1 },
  })
})

test("keeps opaque reasoning for a pure text assistant message on the next turn", async () => {
  const raw = {
    choices: [
      {
        index: 0,
        message: {
          content: "First reply",
          reasoning_opaque: "private-state",
          reasoning_content: "private reasoning",
        },
        finish_reason: "stop",
      },
    ],
  }
  const response = await translateGeminiResponse(
    Response.json(raw),
    context(false),
  )
  const body = (await response.json()) as JsonObject
  expect(body.status).toBe("completed")
  const output = body.output as Array<JsonObject>
  expect(
    output.find((item) => item.type === "reasoning")?.encrypted_content,
  ).toBeString()
  const replay = translateGeminiRequest(
    JSON.stringify({
      model: "gemini-4-carbon",
      input: [...output, { role: "user", content: "Continue" }],
    }),
  )
  expect(replay.payload.messages).toContainEqual({
    role: "assistant",
    content: "First reply",
    reasoning_opaque: "private-state",
    reasoning_content: "private reasoning",
  })
})

test("passes HTTP failures through without converting or consuming their body", async () => {
  const upstream = Response.json(
    { error: { code: "rate_limit", message: "Slow down" } },
    { status: 429, headers: { "retry-after": "3" } },
  )
  const translated = await translateGeminiResponse(upstream, context())
  expect(translated).toBe(upstream)
  expect(translated.bodyUsed).toBe(false)
  expect(translated.headers.get("retry-after")).toBe("3")
})

test("client cancellation reaches a pending upstream read", async () => {
  let cancelReason: unknown
  const upstream = new Response(
    new ReadableStream<Uint8Array>({
      cancel(reason) {
        cancelReason = reason
      },
    }),
    { headers: { "content-type": "text/event-stream" } },
  )
  const translated = await translateGeminiResponse(upstream, context())
  const reader = readerFor(translated)
  expect((await one(reader)).type).toBe("response.created")
  expect((await one(reader)).type).toBe("response.in_progress")
  const pending = reader.read()
  await Promise.resolve()
  await reader.cancel("client left")
  expect((await pending).done).toBe(true)
  expect(cancelReason).toBe("client left")
})

test("malformed custom arguments and unknown tool names fail instead of completing", async () => {
  for (const [name, argumentsText] of [
    ["patch", '{"input":123}'],
    ["unknown", "{}"],
  ]) {
    const settings = {
      ...context(),
      tools: { patch: { type: "custom" as const, name: "patch" } },
    }
    const raw =
      frame(
        {
          tool_calls: [
            {
              index: 0,
              id: "call-1",
              type: "function",
              function: { name, arguments: argumentsText },
            },
          ],
        },
        "tool_calls",
      ) + "data: [DONE]\n\n"
    const observed = events(
      await (await translateGeminiResponse(sse(raw), settings)).text(),
    )
    expect(observed.at(-1)?.type).toBe("response.failed")
    expect(completed(observed).status).toBe("failed")
  }
})
