import assert from "node:assert/strict"
import { once } from "node:events"
import http from "node:http"
import { setImmediate } from "node:timers/promises"
import { toNodeHandler } from "srvx/node"

import { state } from "~/lib/state"
import { server } from "~/server"

Object.assign(state, {
  apiKey: "synthetic-client",
  copilotToken: "synthetic-upstream",
  manualApprove: false,
})

let calls = 0
let upstreamCancelled = false
let upstreamStarted: (() => void) | undefined
let upstreamStopped: (() => void) | undefined
const started = new Promise<void>((resolve) => {
  upstreamStarted = resolve
})
const stopped = new Promise<void>((resolve) => {
  upstreamStopped = resolve
})
globalThis.fetch = Object.assign(
  async (_url: unknown, options?: RequestInit) => {
    calls++
    await setImmediate()
    assert.equal(
      options?.signal?.aborted,
      false,
      "a fully read request is not a disconnect",
    )
    if (calls === 1) return new Response("synthetic-decision")
    upstreamStarted?.()
    return new Promise<Response>((resolve) => {
      options.signal?.addEventListener(
        "abort",
        () => {
          upstreamCancelled = true
          upstreamStopped?.()
          resolve(new Response("cancelled"))
        },
        { once: true },
      )
    })
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
  path: "/v1/systemone",
  method: "POST",
  headers: {
    authorization: "Bearer synthetic-client",
    "content-type": "application/json",
  },
}
try {
  const normal = http.request(options)
  normal.end('{"model":"microsoft-decision-1"}')
  const [response] = (await once(normal, "response")) as [http.IncomingMessage]
  let text = ""
  for await (const chunk of response) text += String(chunk)
  assert.equal(response.statusCode, 200)
  assert.equal(text, "synthetic-decision")

  const cancelled = http.request(options)
  cancelled.on("error", () => {
    /* Expected socket close from destroy(). */
  })
  cancelled.end('{"model":"microsoft-decision-1"}')
  await started
  cancelled.destroy()
  await stopped
  assert.equal(upstreamCancelled, true)
  assert.equal(calls, 2)
  process.stdout.write("NODE_SYSTEMONE_OK\n")
} finally {
  listener.closeAllConnections()
  listener.close()
}
