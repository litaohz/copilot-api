import assert from "node:assert/strict"
import { once } from "node:events"
import http from "node:http"
import { setImmediate } from "node:timers/promises"
import { toNodeHandler } from "srvx/node"

import { state } from "~/lib/state"
import { stats } from "~/lib/stats"
import { server } from "~/server"

Object.assign(state, {
  apiKey: "synthetic-client",
  copilotToken: "synthetic-upstream",
  copilotApiBaseUrl: "https://synthetic-upstream.invalid",
  manualApprove: false,
  paused: false,
  rateLimitSeconds: undefined,
})

let calls = 0
let upstreamCancelled = false
let notifyStopped: (() => void) | undefined
const stopped = new Promise<void>((resolve) => {
  notifyStopped = resolve
})
const encoder = new TextEncoder()

globalThis.fetch = Object.assign(
  async (url: unknown, options?: RequestInit) => {
    calls++
    assert.equal(url, "https://synthetic-upstream.invalid/chat/completions")
    await setImmediate()
    assert.equal(
      options?.signal?.aborted,
      false,
      "a completed request body is not a disconnect",
    )
    assert.equal(typeof options.body, "string")
    const payload = JSON.parse(options.body as string) as {
      model: string
      messages: Array<{ content: string }>
    }
    assert.equal(payload.model, "gemini-4-carbon")
    assert.equal(payload.messages[0].content, "Reply OK")
    if (calls === 1)
      return Response.json({
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "OK" },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 },
      })
    const signal = options.signal
    assert(signal)
    return new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          signal.addEventListener(
            "abort",
            () => {
              upstreamCancelled = true
              controller.error(new Error("synthetic client disconnect"))
              notifyStopped?.()
            },
            { once: true },
          )
          controller.enqueue(
            encoder.encode(
              'data: {"choices":[{"index":0,"delta":{"content":"partial"},"finish_reason":null}]}\n\n',
            ),
          )
        },
      }),
      { headers: { "content-type": "text/event-stream" } },
    )
  },
  { preconnect: globalThis.fetch.preconnect },
)

const listener = http.createServer(toNodeHandler(server.fetch))
listener.listen(0, "127.0.0.1")
await once(listener, "listening")
const address = listener.address()
assert(address && typeof address !== "string")
const options = {
  host: "127.0.0.1",
  port: address.port,
  path: "/v1/responses",
  method: "POST",
  headers: {
    authorization: "Bearer synthetic-client",
    "content-type": "application/json",
  },
}

try {
  const normal = http.request(options)
  normal.end(
    JSON.stringify({
      model: "gemini-4-carbon",
      input: "Reply OK",
      stream: false,
    }),
  )
  const [response] = (await once(normal, "response")) as [http.IncomingMessage]
  let text = ""
  for await (const chunk of response) text += String(chunk)
  assert.equal(response.statusCode, 200)
  const result = JSON.parse(text) as {
    object: string
    status: string
    output: Array<{ content: Array<{ text: string }> }>
  }
  assert.equal(result.object, "response")
  assert.equal(result.status, "completed")
  assert.equal(result.output[0].content[0].text, "OK")
  await setImmediate()
  assert.equal(stats.totalRequests, 1)
  assert.equal(
    stats.tokens.total,
    3,
    "the real stats middleware scanned the translated response",
  )

  const cancelled = http.request(options)
  cancelled.on("error", () => {
    /* Expected socket close from destroy(). */
  })
  const partial = new Promise<void>((resolve, reject) => {
    cancelled.once("response", (stream) => {
      assert.equal(stream.statusCode, 200)
      assert.match(String(stream.headers["content-type"]), /text\/event-stream/)
      let received = ""
      stream.on("data", (chunk: Buffer) => {
        received += chunk.toString()
        if (!received.includes("response.output_text.delta")) return
        assert.equal(
          stats.totalRequests,
          2,
          "the streaming response went through stats tee",
        )
        assert.equal(upstreamCancelled, false)
        cancelled.destroy()
        stream.destroy()
        resolve()
      })
      stream.on("error", reject)
    })
  })
  cancelled.end(
    JSON.stringify({
      model: "gemini-4-carbon",
      input: "Reply OK",
      stream: true,
    }),
  )
  await partial
  await stopped
  assert.equal(upstreamCancelled, true)
  assert.equal(calls, 2)
  process.stdout.write("NODE_GEMINI_OK\n")
} finally {
  listener.closeAllConnections()
  listener.close()
}
