import { afterAll, afterEach, expect, spyOn, test } from "bun:test"

import { state } from "~/lib/state"
import { stats } from "~/lib/stats"
import { server } from "~/server"

const originalState = { ...state }
const preconnect = globalThis.fetch.preconnect
const fetchSpy = spyOn(globalThis, "fetch")
afterAll(() => fetchSpy.mockRestore())

afterEach(() => {
  fetchSpy.mockReset()
  Object.assign(state, {
    apiKey: undefined,
    copilotToken: undefined,
    githubHost: undefined,
    copilotApiBaseUrl: undefined,
    rateLimitSeconds: undefined,
    lastRequestTimestamp: undefined,
    ...originalState,
  })
})

function prepare() {
  Object.assign(state, {
    apiKey: "synthetic-client",
    copilotToken: "synthetic-upstream",
    githubHost: "microsoft.ghe.com",
    copilotApiBaseUrl: "https://copilot-api.microsoft.ghe.com",
    manualApprove: false,
    paused: false,
    rateLimitSeconds: undefined,
  })
  return fetchSpy
}

const request = (key = "synthetic-client") =>
  server.request("/v1/systemone", {
    method: "POST",
    headers: { authorization: `Bearer ${key}` },
    body: "{}",
  })

test("both SystemOne routes preserve the payload and use the selected enterprise credentials", async () => {
  const upstream = prepare()
  const body = '{ "model": "microsoft-decision-1", "unknown": [1, null] }\n'
  upstream.mockImplementation(
    Object.assign(
      () =>
        Promise.resolve(
          new Response('{"decision":"synthetic"}', {
            headers: {
              "content-type": "application/json",
              "x-request-id": "synthetic-request-id",
              "set-cookie": "must-not-forward",
              "content-length": "24",
            },
          }),
        ),
      { preconnect },
    ),
  )
  for (const path of ["/systemone", "/v1/systemone"]) {
    const response = await server.request(path, {
      method: "POST",
      headers: {
        authorization: "Bearer synthetic-client",
        "content-type": "application/json",
        "x-api-key": "client-key-must-not-leak",
        "copilot-integration-id": "must-not-override",
        cookie: "private-client-cookie",
      },
      body,
    })
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('{"decision":"synthetic"}')
    expect(response.headers.get("x-request-id")).toBe("synthetic-request-id")
    expect(response.headers.has("set-cookie")).toBe(false)
    expect(response.headers.has("content-length")).toBe(false)
  }
  expect(upstream).toHaveBeenCalledTimes(2)
  for (const [url, options] of upstream.mock.calls) {
    expect(url).toBe("https://copilot-api.microsoft.ghe.com/v1/systemone")
    expect(options?.body).toBe(body)
    expect(options?.redirect).toBe("error")
    const headers = new Headers(options?.headers)
    expect(headers.get("authorization")).toBe("Bearer synthetic-upstream")
    expect(headers.get("copilot-integration-id")).toBe("vscode-chat")
    expect(headers.has("x-api-key")).toBe(false)
    expect(headers.has("cookie")).toBe(false)
  }
  expect(stats.recent.at(-1)?.model).toBe("microsoft-decision-1")
})

test("SystemOne keeps plaintext errors, retry information and streams intact", async () => {
  const upstream = prepare()
  for (const [status, wire, contentType] of [
    [400, "Bad Request", "text/plain"],
    [429, '{"error":{"code":"rate_limited"}}', "application/json"],
    [200, 'data: {"decision":true}\n\n', "text/event-stream"],
  ] as const) {
    upstream.mockResolvedValueOnce(
      new Response(wire, {
        status,
        headers: { "content-type": contentType, "retry-after": "3" },
      }),
    )
    const response = await server.request("/v1/systemone", {
      method: "POST",
      headers: { "x-api-key": "synthetic-client" },
      body: "{}",
    })
    expect(response.status).toBe(status)
    expect(response.headers.get("content-type")).toBe(contentType)
    expect(response.headers.get("retry-after")).toBe("3")
    expect(await response.text()).toBe(wire)
  }
})

test("SystemOne enforces client authentication, pause and rate limits before upstream calls", async () => {
  const upstream = prepare()
  expect((await request("wrong")).status).toBe(401)
  state.paused = true
  expect((await request()).status).toBe(503)
  state.paused = false
  state.rateLimitSeconds = 60
  state.lastRequestTimestamp = Date.now()
  expect((await request()).status).toBe(429)
  expect(upstream).not.toHaveBeenCalled()
})

test("SystemOne propagates client cancellation to fetch", async () => {
  const upstream = prepare()
  const abort = new AbortController()
  upstream.mockResolvedValueOnce(new Response("{}"))
  await server.request("/v1/systemone", {
    method: "POST",
    headers: { authorization: "Bearer synthetic-client" },
    body: "{}",
    signal: abort.signal,
  })
  const signal = upstream.mock.calls[0]?.[1]?.signal
  expect(signal?.aborted).toBe(false)
  abort.abort()
  expect(signal?.aborted).toBe(true)
})

test("SystemOne retries a 401 once with the refreshed token and endpoint", async () => {
  const upstream = prepare()
  upstream
    .mockResolvedValueOnce(new Response("expired", { status: 401 }))
    .mockResolvedValueOnce(
      Response.json({
        token: "synthetic-refreshed",
        refresh_in: 1800,
        expires_at: 1900,
        endpoints: { api: "https://api.enterprise.githubcopilot.com" },
      }),
    )
    .mockResolvedValueOnce(new Response("still unauthorized", { status: 401 }))
  const response = await request()
  expect(response.status).toBe(401)
  expect(await response.text()).toBe("still unauthorized")
  expect(upstream).toHaveBeenCalledTimes(3)
  expect(upstream.mock.calls[2]?.[0]).toBe(
    "https://api.enterprise.githubcopilot.com/v1/systemone",
  )
  expect(
    new Headers(upstream.mock.calls[2]?.[1]?.headers).get("authorization"),
  ).toBe("Bearer synthetic-refreshed")
})
