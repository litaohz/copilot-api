import { expect, test } from "bun:test"
import { Hono } from "hono"

import { apiKeyAuth } from "~/lib/auth"
import { state } from "~/lib/state"
import { stats } from "~/lib/stats"
import { statsMiddleware } from "~/lib/stats-middleware"
import { handleResponses } from "~/routes/responses/handler"

test("both key headers reach the restored Responses pipeline with stable IDs and attribution", async () => {
  const originalFetch = globalThis.fetch
  const originalState = { ...state }
  const originalNames = process.env.COPILOT_API_KEY_NAMES
  const events = [
    {
      type: "response.created",
      response: { id: "first-response", output: [] },
    },
    {
      type: "response.output_item.added",
      output_index: 0,
      item: { id: "first-item", type: "message" },
    },
    {
      type: "response.output_item.done",
      output_index: 0,
      item: { id: "different-item", type: "message" },
    },
    {
      type: "response.completed",
      response: {
        id: "different-response",
        output: [{ id: "different-final-item", type: "message" }],
        usage: { input_tokens: 3, output_tokens: 2, total_tokens: 5 },
      },
    },
  ]
  const wire = events
    .map((event) => `data: ${JSON.stringify(event)}\n\n`)
    .join("")
  let upstreamCalls = 0
  try {
    Object.assign(state, {
      apiKey: "synthetic-a,synthetic-b",
      copilotToken: "synthetic-upstream",
      manualApprove: false,
      rateLimitSeconds: undefined,
      accountType: "individual",
    })
    process.env.COPILOT_API_KEY_NAMES = "integration-a,integration-b"
    globalThis.fetch = Object.assign(
      () => {
        upstreamCalls++
        return Promise.resolve(
          new Response(wire, {
            headers: { "content-type": "text/event-stream" },
          }),
        )
      },
      { preconnect: originalFetch.preconnect },
    ) as typeof fetch
    const app = new Hono()
    app.use(statsMiddleware())
    app.use(apiKeyAuth())
    app.post("/v1/responses", handleResponses)
    for (const headers of [
      new Headers({ authorization: "Bearer synthetic-a" }),
      new Headers({ "x-api-key": "synthetic-b" }),
    ]) {
      const response = await app.request("/v1/responses", {
        method: "POST",
        headers,
        body: '{"model":"gpt-6-astra","stream":true,"input":"synthetic"}',
      })
      expect(response.status).toBe(200)
      const output = await response.text()
      expect(output).toContain("first-response")
      expect(output).toContain("first-item")
      expect(output).not.toContain("different-")
    }
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(stats.byKey.get("integration-a")?.tokens).toBe(5)
    expect(stats.byKey.get("integration-b")?.tokens).toBe(5)
    const rejected = await app.request("/v1/responses", {
      method: "POST",
      body: "{}",
    })
    expect(rejected.status).toBe(401)
    expect(upstreamCalls).toBe(2)
  } finally {
    // eslint-disable-next-line require-atomic-updates -- This non-concurrent test owns the fetch override until finally.
    globalThis.fetch = originalFetch
    Object.assign(state, originalState)
    if (originalNames === undefined) delete process.env.COPILOT_API_KEY_NAMES
    // eslint-disable-next-line require-atomic-updates -- Restore the environment owned by this non-concurrent test.
    else process.env.COPILOT_API_KEY_NAMES = originalNames
  }
})
