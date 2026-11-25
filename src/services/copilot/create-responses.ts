import { filterResponseHeaders, postCopilotPassthrough } from "./passthrough"

export interface ResponsesPayload {
  model?: string
  stream?: boolean | null
  [key: string]: unknown
}

const RESPONSE_HEADERS_TO_FORWARD = [
  "content-type",
  "cache-control",
  "x-request-id",
] as const

export function isResponsesModelAllowed(bodyText: string): boolean {
  const payload = tryParsePayload(bodyText)
  return (
    typeof payload?.model === "string"
    && (payload.model.startsWith("gpt") || payload.model.startsWith("gemini-"))
  )
}

function tryParsePayload(bodyText: string): ResponsesPayload | undefined {
  try {
    return JSON.parse(bodyText) as ResponsesPayload
  } catch {
    return undefined
  }
}

export const createResponses = async (
  bodyText: string,
  requestHeaders?: Headers,
) => {
  const filtered = filterUnsupportedTools(bodyText)
  return postCopilotPassthrough({
    path: "/responses",
    body: filtered,
    requestHeaders,
    initiator: "user",
    errorMessage: "Failed to create responses",
    throwOnError: true,
  })
}

function filterUnsupportedTools(bodyText: string): string {
  const payload = tryParsePayload(bodyText)
  if (!payload?.tools || !Array.isArray(payload.tools)) return bodyText
  const UNSUPPORTED_TOOL_TYPES = new Set(["image_generation"])
  const filtered = payload.tools.filter(
    (tool: { type?: string }) => !UNSUPPORTED_TOOL_TYPES.has(tool.type ?? ""),
  )
  if (filtered.length === payload.tools.length) return bodyText
  payload.tools = filtered
  return JSON.stringify(payload)
}

export function getForwardHeaders(headers: Headers): Headers {
  return filterResponseHeaders(headers, RESPONSE_HEADERS_TO_FORWARD)
}
