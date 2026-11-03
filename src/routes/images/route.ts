import { Hono, type Context } from "hono"

import { awaitApproval } from "~/lib/approval"
import { clientDisconnectSignal } from "~/lib/client-disconnect"
import { forwardError } from "~/lib/error"
import { checkRateLimit } from "~/lib/rate-limit"
import { state } from "~/lib/state"
import {
  filterResponseHeaders,
  postCopilotPassthrough,
} from "~/services/copilot/passthrough"

export const imageRoutes = new Hono()

const RESPONSE_HEADERS = [
  "content-type",
  "cache-control",
  "x-request-id",
  "x-github-request-id",
  "retry-after",
] as const

async function forwardImageRequest(
  path: "/v1/images/generations" | "/v1/images/edits",
  errorMessage: string,
  c: Context,
) {
  try {
    await checkRateLimit(state)
    const body = Buffer.from(await c.req.arrayBuffer())
    if (state.manualApprove) await awaitApproval()
    const response = await postCopilotPassthrough({
      path,
      body,
      requestHeaders: c.req.raw.headers,
      forwardRequestHeaders: ["content-type", "accept"],
      initiator: "user",
      errorMessage,
      signal: clientDisconnectSignal(c.req.raw),
      redirect: "error",
    })
    return new Response(response.body, {
      status: response.status,
      headers: filterResponseHeaders(response.headers, RESPONSE_HEADERS),
    })
  } catch (error) {
    return await forwardError(c, error)
  }
}

imageRoutes.post("/generations", (c) =>
  forwardImageRequest(
    "/v1/images/generations",
    "Image generation request failed",
    c,
  ),
)

imageRoutes.post("/edits", (c) =>
  forwardImageRequest("/v1/images/edits", "Image edit request failed", c),
)
