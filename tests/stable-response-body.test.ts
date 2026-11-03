import { expect, test } from "bun:test"

import { bodyWithStableResponseIds } from "~/lib/responses/stable-response-body"

interface StreamItem {
  id: string
  type: string
  phase?: string
  role?: string
  status?: string
  content?: Array<{ type: string; text: string }>
  call_id?: string
  name?: string
  arguments?: string
  encrypted_content?: string
}

interface StreamEvent {
  type: string
  response?: { id: string; output: Array<StreamItem>; status?: string }
  output_index?: number
  item?: StreamItem
  item_id?: string
  delta?: string
  text?: string
  arguments?: string
  [key: string]: unknown
}

const messageText = "我先核查一下，再继续。"
const toolArguments = '{"id":"leave-arguments-id","query":"汉字🙂"}'
const opaque = {
  id: "leave-metadata-id",
  item_id: "leave-metadata-item-id",
  response_id: "leave-metadata-response-id",
}

function rotatedEvents(): Array<StreamEvent> {
  const message: StreamItem = {
    id: "message-done",
    type: "message",
    phase: "commentary",
    role: "assistant",
    status: "completed",
    content: [{ type: "output_text", text: messageText }],
  }
  const call: StreamItem = {
    id: "call-done",
    type: "function_call",
    call_id: "leave-call-id",
    name: "read_context",
    arguments: toolArguments,
    encrypted_content: "leave-opaque-ciphertext",
    status: "completed",
  }
  return [
    {
      type: "response.created",
      response: { id: "response-original", output: [] },
    },
    {
      type: "response.output_item.added",
      output_index: 0,
      item: {
        ...message,
        id: "message-original",
        status: "in_progress",
        content: [],
      },
    },
    {
      type: "response.output_text.delta",
      output_index: 0,
      item_id: "message-delta",
      content_index: 0,
      delta: messageText,
      metadata: opaque,
    },
    {
      type: "response.output_text.done",
      output_index: 0,
      item_id: "message-text-done",
      content_index: 0,
      text: messageText,
    },
    { type: "response.output_item.done", output_index: 0, item: message },
    {
      type: "response.output_item.added",
      output_index: 1,
      item: {
        ...call,
        id: "call-original",
        status: "in_progress",
        arguments: "",
      },
    },
    {
      type: "response.function_call_arguments.delta",
      output_index: 1,
      item_id: "call-delta",
      delta: toolArguments,
    },
    {
      type: "response.function_call_arguments.done",
      output_index: 1,
      item_id: "call-arguments-done",
      arguments: toolArguments,
    },
    { type: "response.output_item.done", output_index: 1, item: call },
    {
      type: "response.completed",
      response: {
        id: "response-completed",
        status: "completed",
        output: [
          { ...message, id: "message-snapshot" },
          { ...call, id: "call-snapshot" },
        ],
      },
      metadata: opaque,
    },
  ]
}

function frameEvents(events: Array<StreamEvent>, newline = "\n"): string {
  return events
    .map(
      (event) =>
        `event: ${event.type}${newline}data: ${JSON.stringify(event)}${newline}${newline}`,
    )
    .join("")
}

function parseEvents(wire: string): Array<StreamEvent> {
  return wire
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data: "))
    .map((line) => JSON.parse(line.slice(6)) as StreamEvent)
}

function upstream(
  body: string | ReadableStream<Uint8Array> | null,
  contentType = "text/event-stream",
  status = 200,
): Response {
  return new Response(body, {
    status,
    headers: { "content-type": contentType },
  })
}

for (const model of [
  "gpt-6.1-sol",
  "gpt-6-sol",
  "gpt-6-astra",
  "gpt-5.4",
  "gpt-4.1",
]) {
  test(`${model} correlates commentary and tools across delta, done and snapshots`, async () => {
    const original = rotatedEvents()
    const response = upstream(frameEvents(original))
    const body = bodyWithStableResponseIds(
      response,
      JSON.stringify({ model, stream: true }),
    )
    const actual = parseEvents(await new Response(body).text())
    const canonicalItemIds = ["message-original", "call-original"]
    const expected = original.map((event) => ({
      ...event,
      ...(event.item_id ?
        { item_id: canonicalItemIds[event.output_index ?? -1] }
      : {}),
      ...(event.item ?
        {
          item: {
            ...event.item,
            id: canonicalItemIds[event.output_index ?? -1],
          },
        }
      : {}),
      ...(event.response ?
        {
          response: {
            ...event.response,
            id: "response-original",
            output: event.response.output.map((item, index) => ({
              ...item,
              id: canonicalItemIds[index],
            })),
          },
        }
      : {}),
    }))
    expect(actual).toEqual(expected)
    expect(actual).toHaveLength(original.length)

    // A client accumulating deltas and completing messages by ID sees one item.
    const messages = new Map<string, string>()
    for (const event of actual) {
      if (event.type === "response.output_text.delta" && event.item_id) {
        messages.set(
          event.item_id,
          (messages.get(event.item_id) ?? "") + (event.delta ?? ""),
        )
      }
      if (
        event.type === "response.output_item.done"
        && event.item?.type === "message"
      ) {
        expect(messages.get(event.item.id)).toBe(event.item.content?.[0]?.text)
        expect(event.item.phase).toBe("commentary")
      }
    }
    expect([...messages]).toEqual([["message-original", messageText]])
  })
}

test("stable GPT streams preserve original bytes and accept SSE MIME parameters", async () => {
  const stableEvents: Array<StreamEvent> = [
    { type: "response.created", response: { id: "response", output: [] } },
    {
      type: "response.output_item.added",
      output_index: 0,
      item: {
        id: "message",
        type: "message",
        phase: "commentary",
        content: [],
      },
    },
    {
      type: "response.output_text.delta",
      output_index: 0,
      item_id: "message",
      delta: messageText,
    },
  ]
  const wire =
    "\ufeff: heartbeat\r\n\r\n"
    + frameEvents(stableEvents, "\r\n")
    + "data: [DONE]\r\n\r\n"
  const response = upstream(wire, "Text/Event-Stream; charset=UTF-8")
  const body = bodyWithStableResponseIds(
    response,
    '{"model":"gpt-6.1-sol","stream":true}',
  )
  expect(
    Array.from(new Uint8Array(await new Response(body).arrayBuffer())),
  ).toEqual(Array.from(new TextEncoder().encode(wire)))
})

const excludedPayloads: Array<[string, unknown]> = [
  ["non-GPT model", { model: "claude-sonnet-4", stream: true }],
  ["missing model", { stream: true }],
  ["numeric model", { model: 6, stream: true }],
  ["object model", { model: { name: "gpt-6.1-sol" }, stream: true }],
  ["missing stream", { model: "gpt-6.1-sol" }],
  ["false stream", { model: "gpt-6.1-sol", stream: false }],
  ["string stream", { model: "gpt-6.1-sol", stream: "true" }],
  ["null request", null],
  ["array request", []],
  ["string request", "gpt-6.1-sol"],
]

for (const [label, payload] of excludedPayloads) {
  test(`${label} keeps the original upstream body`, () => {
    const response = upstream(frameEvents(rotatedEvents()))
    expect(bodyWithStableResponseIds(response, JSON.stringify(payload))).toBe(
      response.body,
    )
  })
}

for (const contentType of [
  "application/json",
  "application/text/event-stream",
  "text/event-stream-invalid",
  "application/json; note=text/event-stream",
]) {
  test(`${contentType} keeps the original upstream body`, () => {
    const response = upstream(frameEvents(rotatedEvents()), contentType)
    expect(
      bodyWithStableResponseIds(
        response,
        '{"model":"gpt-6.1-sol","stream":true}',
      ),
    ).toBe(response.body)
  })
}

test("malformed JSON, disabled compatibility, errors and empty bodies pass through", () => {
  const request = '{"model":"gpt-6.1-sol","stream":true}'
  const response = upstream(frameEvents(rotatedEvents()))
  expect(bodyWithStableResponseIds(response, "{broken")).toBe(response.body)
  expect(bodyWithStableResponseIds(response, request, false)).toBe(
    response.body,
  )
  const rejected = upstream("upstream error", "text/event-stream", 429)
  expect(bodyWithStableResponseIds(rejected, request)).toBe(rejected.body)
  const empty = upstream(null)
  expect(bodyWithStableResponseIds(empty, request)).toBeNull()
})
