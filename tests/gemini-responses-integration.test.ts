import { afterEach, beforeEach, expect, spyOn, test } from "bun:test"
import { rejects } from "node:assert/strict"

import { state } from "~/lib/state"
import { server } from "~/server"
import { createGeminiResponses } from "~/services/copilot/create-gemini-responses"

const originalState = { ...state }
const preconnect = globalThis.fetch.preconnect
let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, "fetch">>

beforeEach(() => {
  fetchSpy = spyOn(globalThis, "fetch")
})

afterEach(() => {
  fetchSpy.mockRestore()
  Object.assign(state, {
    apiKey: undefined,
    copilotToken: undefined,
    copilotApiBaseUrl: undefined,
    rateLimitSeconds: undefined,
    ...originalState,
  })
})

function prepare() {
  fetchSpy.mockReset()
  Object.assign(state, {
    apiKey: "synthetic-client",
    copilotToken: "synthetic-upstream",
    copilotApiBaseUrl: "https://copilot-api.msft.ghe.com",
    accountType: "enterprise",
    manualApprove: false,
    paused: false,
    rateLimitSeconds: undefined,
  })
}

const body = {
  model: "gemini-4-carbon",
  instructions: "Be concise.",
  input: "Reply OK.",
  stream: false,
}

test("tool-free Codex requests pass strict upstream tool-choice validation", async () => {
  prepare()
  fetchSpy.mockImplementation(
    Object.assign(
      (_url: string | URL | Request, options?: RequestInit) => {
        const payload = JSON.parse(options?.body as string) as Record<
          string,
          unknown
        >
        if (
          payload.tool_choice !== undefined
          && (!Array.isArray(payload.tools) || payload.tools.length === 0)
        ) {
          return Promise.resolve(
            Response.json(
              {
                error: {
                  message: "tools are required when tool choice is specified",
                  code: "invalid_request_body",
                },
              },
              { status: 400 },
            ),
          )
        }
        return Promise.resolve(
          Response.json({
            choices: [
              {
                index: 0,
                message: { role: "assistant", content: "OK" },
                finish_reason: "stop",
              },
            ],
          }),
        )
      },
      { preconnect },
    ),
  )
  const response = await server.request("/v1/responses", {
    method: "POST",
    headers: { "x-api-key": "synthetic-client" },
    body: JSON.stringify({
      ...body,
      tools: [],
      tool_choice: "auto",
      parallel_tool_calls: true,
      reasoning: { effort: "high" },
    }),
  })
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({
    status: "completed",
    output: [{ type: "message", content: [{ text: "OK" }] }],
  })
  expect(fetchSpy).toHaveBeenCalledTimes(1)
})

test("requiring tools without declarations fails locally before fetch", async () => {
  prepare()
  const response = await server.request("/v1/responses", {
    method: "POST",
    headers: { "x-api-key": "synthetic-client" },
    body: JSON.stringify({ ...body, tools: [], tool_choice: "required" }),
  })
  expect(response.status).toBe(400)
  expect(await response.json()).toMatchObject({
    error: { type: "invalid_request_error", param: "tool_choice" },
  })
  expect(fetchSpy).not.toHaveBeenCalled()
})

test("authenticated Responses aliases route Gemini through Chat without leaking client credentials", async () => {
  prepare()
  fetchSpy.mockImplementation(
    Object.assign(
      () =>
        Promise.resolve(
          Response.json(
            {
              id: "chatcmpl-upstream",
              model: body.model,
              choices: [
                {
                  index: 0,
                  message: { role: "assistant", content: "OK" },
                  finish_reason: "stop",
                },
              ],
              usage: {
                prompt_tokens: 4,
                completion_tokens: 2,
                total_tokens: 6,
              },
            },
            { headers: { "x-request-id": "synthetic-request" } },
          ),
        ),
      { preconnect },
    ),
  )
  for (const path of ["/responses", "/v1/responses"]) {
    const response = await server.request(path, {
      method: "POST",
      headers: {
        authorization: "Bearer synthetic-client",
        "x-api-key": "do-not-forward",
        cookie: "private-client-cookie",
      },
      body: JSON.stringify(body),
    })
    expect(response.status).toBe(200)
    const result = (await response.json()) as {
      object: string
      status: string
      output: Array<{ content: Array<{ text: string }> }>
      usage: { input_tokens: number; output_tokens: number }
    }
    expect(result.object).toBe("response")
    expect(result.status).toBe("completed")
    expect(result.output[0].content[0].text).toBe("OK")
    expect(result.usage.input_tokens).toBe(4)
    expect(result.usage.output_tokens).toBe(2)
    expect(response.headers.get("x-request-id")).toBe("synthetic-request")
  }
  expect(fetchSpy).toHaveBeenCalledTimes(2)
  for (const [url, options] of fetchSpy.mock.calls) {
    expect(url).toBe("https://copilot-api.msft.ghe.com/chat/completions")
    const headers = new Headers(options?.headers)
    expect(headers.get("authorization")).toBe("Bearer synthetic-upstream")
    expect(headers.get("X-Initiator")).toBe("user")
    expect(headers.has("x-api-key")).toBe(false)
    expect(headers.has("cookie")).toBe(false)
    expect(JSON.parse(options?.body as string)).toMatchObject({
      model: body.model,
      messages: [
        { role: "system", content: "Be concise." },
        { role: "user", content: "Reply OK." },
      ],
    })
  }
})

test("Gemini validation and authentication failures never reach upstream", async () => {
  prepare()
  const unauthenticated = await server.request("/v1/responses", {
    method: "POST",
    body: JSON.stringify(body),
  })
  expect(unauthenticated.status).toBe(401)
  const unsupported = await server.request("/v1/responses", {
    method: "POST",
    headers: { "x-api-key": "synthetic-client" },
    body: JSON.stringify({ ...body, previous_response_id: "resp-unavailable" }),
  })
  expect(unsupported.status).toBe(400)
  expect(await unsupported.json()).toMatchObject({
    error: { type: "invalid_request_error" },
  })
  expect(fetchSpy).not.toHaveBeenCalled()
})

test("Gemini keeps structured upstream failures and retry information", async () => {
  prepare()
  fetchSpy.mockResolvedValueOnce(
    Response.json(
      { error: { code: "rate_limit_exceeded", message: "Try later" } },
      {
        status: 429,
        headers: { "retry-after": "3", "x-request-id": "limited" },
      },
    ),
  )
  const response = await server.request("/v1/responses", {
    method: "POST",
    headers: { "x-api-key": "synthetic-client" },
    body: JSON.stringify(body),
  })
  expect(response.status).toBe(429)
  expect(response.headers.get("retry-after")).toBe("3")
  expect(await response.json()).toEqual({
    error: { code: "rate_limit_exceeded", message: "Try later" },
  })
})

test("the Gemini bridge propagates the request abort to its upstream fetch", async () => {
  prepare()
  const controller = new AbortController()
  let upstreamSignal: AbortSignal | undefined
  let notifyStarted: (() => void) | undefined
  const started = new Promise<void>((resolve) => {
    notifyStarted = resolve
  })
  fetchSpy.mockImplementation(
    Object.assign(
      (_url: string | URL | Request, options?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          upstreamSignal = options?.signal ?? undefined
          upstreamSignal?.addEventListener(
            "abort",
            () => reject(new Error("Aborted")),
            { once: true },
          )
          notifyStarted?.()
        }),
      { preconnect },
    ),
  )
  const result = createGeminiResponses(
    JSON.stringify(body),
    new Headers(),
    controller.signal,
  )
  await started
  controller.abort()
  await rejects(result, /Aborted/)
  expect(upstreamSignal?.aborted).toBe(true)
})

test("GPT Responses still use the original endpoint and unmodified body", async () => {
  prepare()
  const wire =
    '{ "model": "gpt-6.2-sol", "input": "OK", "stream": false, "unknown": [1] }\n'
  const upstream = '{"object":"response","id":"native","output":[]}'
  fetchSpy.mockResolvedValueOnce(
    new Response(upstream, { headers: { "content-type": "application/json" } }),
  )
  const response = await server.request("/v1/responses", {
    method: "POST",
    headers: { "x-api-key": "synthetic-client" },
    body: wire,
  })
  expect(await response.text()).toBe(upstream)
  expect(fetchSpy.mock.calls[0]?.[0]).toBe(
    "https://copilot-api.msft.ghe.com/responses",
  )
  expect(fetchSpy.mock.calls[0]?.[1]?.body).toBe(wire)
})
