import { stabilizeResponseStream } from "~/lib/responses/stable-ids.mjs"

/** Correlate GPT Responses items across streaming and completion events. */
export function bodyWithStableResponseIds(
  upstream: Response,
  requestText: string,
  enabled = true,
): Response["body"] {
  if (
    !enabled
    || upstream.status !== 200
    || !upstream.body
    || upstream.headers
      .get("content-type")
      ?.split(";", 1)[0]
      .trim()
      .toLowerCase() !== "text/event-stream"
  )
    return upstream.body

  let payload: unknown
  try {
    payload = JSON.parse(requestText)
  } catch {
    return upstream.body
  }
  if (
    !payload
    || typeof payload !== "object"
    || !("model" in payload)
    || typeof payload.model !== "string"
    || !payload.model.startsWith("gpt")
    || !("stream" in payload)
    || payload.stream !== true
  )
    return upstream.body

  // Stable streams retain their bytes; only observed response/item IDs change.
  return stabilizeResponseStream(upstream.body)
}
