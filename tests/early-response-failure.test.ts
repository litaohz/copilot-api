import { expect, test } from "bun:test"
import { Hono } from "hono"

import { forwardError, HTTPError } from "~/lib/error"
import { normalizeEarlyResponseFailure } from "~/lib/responses/early-failure"

const encoder = new TextEncoder()
const created =
  'data: {"type":"response.created","response":{"id":"original"}}\n\n'
const failed =
  'data: {"type":"response.failed","response":{"status":"failed"}}\n\n'
const detail =
  'data: {"type":"error","code":"invalid_request_body","message":"Encrypted function output content could not be decrypted or decoded."}\n\n'
const progress = 'data: {"type":"response.in_progress"}\n\n'
function sse(body: string | ReadableStream<Uint8Array>, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/event-stream",
      "x-request-id": "original-request",
    },
  })
}

test("pre-generation decryption failure becomes structured HTTP 400", async () => {
  const raw = created + failed + detail
  let offset = 0
  const response = await normalizeEarlyResponseFailure(
    sse(
      new ReadableStream({
        pull(controller) {
          if (offset < raw.length)
            controller.enqueue(encoder.encode(raw[offset++]))
          else controller.close()
        },
      }),
    ),
  )
  expect(response.status).toBe(400)
  expect(response.headers.get("x-request-id")).toBe("original-request")
  expect(await response.json()).toEqual({
    error: {
      code: "invalid_request_body",
      type: "invalid_request_error",
      message:
        "Encrypted function output content could not be decrypted or decoded.",
    },
  })
})

test("healthy streams and failures after in_progress retain all bytes", async () => {
  for (const text of [
    created + progress + 'data: {"type":"response.completed"}\n\n',
    created + progress + failed + detail,
  ]) {
    const response = await normalizeEarlyResponseFailure(sse(text))
    expect(response.status).toBe(200)
    expect(await response.text()).toBe(text)
  }
})

test("lookahead deadline returns without losing a pending read", async () => {
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined
  const source = new ReadableStream<Uint8Array>({
    start(value) {
      controller = value
      value.enqueue(encoder.encode(created))
    },
  })
  const response = await normalizeEarlyResponseFailure(sse(source), 5)
  controller?.enqueue(encoder.encode(failed + detail))
  controller?.close()
  expect(response.status).toBe(200)
  expect(await response.text()).toBe(created + failed + detail)
})

test("prefix budget, malformed events and non-SSE responses pass through", async () => {
  for (const text of [
    ":" + "x".repeat(70_000) + "\n\n" + failed + detail,
    "data: null\n\n",
    "data: nope\n\n",
    "data: [DONE]\n\n",
  ]) {
    const response = await normalizeEarlyResponseFailure(sse(text))
    expect(response.status).toBe(200)
    expect(await response.text()).toBe(text)
  }
  const json = new Response('{"ok":true}', {
    headers: { "content-type": "application/json" },
  })
  expect(await normalizeEarlyResponseFailure(json)).toBe(json)
  const rejected = sse(detail, 429)
  expect(await normalizeEarlyResponseFailure(rejected)).toBe(rejected)
})

test("client cancellation still reaches the original stream", async () => {
  let reason: unknown
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(created + progress))
    },
    cancel(value) {
      reason = value
    },
  })
  const response = await normalizeEarlyResponseFailure(sse(stream))
  await response.body?.cancel("client left")
  expect(reason).toBe("client left")
})

test("upstream read failures retain the original HTTP status and stream error", async () => {
  const failure = new Error("synthetic transport failure")
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.error(failure)
    },
  })
  const response = await normalizeEarlyResponseFailure(sse(stream))
  expect(response.status).toBe(200)
  const observed = await response.text().catch((error: unknown) => error)
  expect(observed).toBe(failure)
})

test("CRLF chunks and late details preserve exact bytes", async () => {
  const rejected = await normalizeEarlyResponseFailure(
    sse((created + failed + detail).replaceAll("\n", "\r\n")),
  )
  expect(rejected.status).toBe(400)
  const incomplete = await normalizeEarlyResponseFailure(sse(created + failed))
  expect(incomplete.status).toBe(200)
  expect(await incomplete.text()).toBe(created + failed)
})

test("HTTP errors preserve upstream code and request ID", async () => {
  const upstream = {
    error: {
      code: "invalid_request_body",
      message: "Cannot decode",
      type: "invalid_request_error",
    },
  }
  const app = new Hono()
  app.get("/", (c) =>
    forwardError(
      c,
      new HTTPError(
        "upstream",
        new Response(JSON.stringify(upstream), {
          status: 400,
          headers: { "x-request-id": "failure-id" },
        }),
      ),
    ),
  )
  const response = await app.request("/")
  expect(response.status).toBe(400)
  expect(response.headers.get("x-request-id")).toBe("failure-id")
  expect(await response.json()).toEqual(upstream)
})
