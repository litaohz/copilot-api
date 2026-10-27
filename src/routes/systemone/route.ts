import { Hono } from "hono"

import { awaitApproval } from "~/lib/approval"
import { forwardError } from "~/lib/error"
import { checkRateLimit } from "~/lib/rate-limit"
import { state } from "~/lib/state"
import {
  filterResponseHeaders,
  postCopilotPassthrough,
} from "~/services/copilot/passthrough"

export const systemOneRoutes = new Hono()

// SystemOne has its own upstream schema. Keep the JSON text and response body
// intact instead of applying Chat/Responses model or message transformations.
systemOneRoutes.post("/", async (c) => {
  try {
    await checkRateLimit(state)
    const body = await c.req.text()
    if (state.manualApprove) await awaitApproval()
    const response = await postCopilotPassthrough({
      path: "/v1/systemone",
      body,
      requestHeaders: c.req.raw.headers,
      forwardRequestHeaders: ["content-type", "accept"],
      initiator: "user",
      errorMessage: "SystemOne request failed",
      signal: c.req.raw.signal,
      redirect: "error",
    })
    return new Response(response.body, {
      status: response.status,
      headers: filterResponseHeaders(response.headers, [
        "content-type",
        "cache-control",
        "x-request-id",
        "x-github-request-id",
        "retry-after",
      ]),
    })
  } catch (error) {
    return await forwardError(c, error)
  }
})
