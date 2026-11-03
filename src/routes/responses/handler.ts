import type { Context } from "hono"

import { awaitApproval } from "~/lib/approval"
import { checkRateLimit } from "~/lib/rate-limit"
import { normalizeEarlyResponseFailure } from "~/lib/responses/early-failure"
import { bodyWithStableResponseIds } from "~/lib/responses/stable-response-body"
import { state } from "~/lib/state"
import {
  createResponses,
  getForwardHeaders,
  isResponsesModelAllowed,
} from "~/services/copilot/create-responses"

export async function handleResponses(c: Context) {
  await checkRateLimit(state)

  const bodyText = await c.req.text()

  if (!isResponsesModelAllowed(bodyText)) {
    return c.json(
      {
        error: {
          message: "Responses API is only enabled for GPT models.",
          type: "invalid_request_error",
        },
      },
      400,
    )
  }

  if (state.manualApprove) {
    await awaitApproval()
  }

  const response = await normalizeEarlyResponseFailure(
    await createResponses(bodyText, c.req.raw.headers),
  )
  return new Response(
    bodyWithStableResponseIds(
      response,
      bodyText,
      process.env.EDGE_STABLE_IDS !== "0",
    ),
    {
      status: response.status,
      headers: getForwardHeaders(response.headers),
    },
  )
}
