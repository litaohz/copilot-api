const CARRIER_PREFIX = "gemini_bridge_v1."
const MAX_CARRIER_LENGTH = 2_000_000

export interface GeminiToolMetadata {
  kind: "tool" | "message"
  model: string
  callIds: Array<string>
  messageId?: string
  fields: Record<string, unknown>
  functionFields?: Record<string, unknown>
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function encode(payload: GeminiToolMetadata): string {
  const carrier =
    CARRIER_PREFIX + Buffer.from(JSON.stringify(payload)).toString("base64url")
  if (carrier.length > MAX_CARRIER_LENGTH)
    throw new Error("Gemini metadata is too large")
  return carrier
}

export function encodeGeminiToolMetadata(
  model: string,
  callId: string,
  toolCall: Record<string, unknown>,
): string | undefined {
  const fields = Object.fromEntries(
    Object.entries(toolCall).filter(
      ([key]) => !["function", "id", "index", "type"].includes(key),
    ),
  )
  const fn = record(toolCall.function) ? toolCall.function : {}
  const functionFields = Object.fromEntries(
    Object.entries(fn).filter(([key]) => !["arguments", "name"].includes(key)),
  )
  if (
    Object.keys(fields).length === 0
    && Object.keys(functionFields).length === 0
  )
    return
  return encode({
    kind: "tool",
    model,
    callIds: [callId],
    fields,
    functionFields,
  })
}

// eslint-disable-next-line max-params -- Both parallel calls and standalone message IDs need explicit replay bindings.
export function encodeGeminiMessageMetadata(
  model: string,
  callIds: Array<string>,
  metadata: Record<string, unknown>,
  messageId?: string,
): string | undefined {
  const fields = Object.fromEntries(
    Object.entries(metadata).filter(
      ([key]) => !["content", "refusal", "role", "tool_calls"].includes(key),
    ),
  )
  if (Object.keys(fields).length === 0) return
  if (callIds.length === 0 && !messageId)
    throw new Error("Gemini metadata has no message binding")
  return encode({
    kind: "message",
    model,
    callIds,
    fields,
    ...(messageId ? { messageId } : {}),
  })
}

export function decodeGeminiToolMetadata(
  encoded: string,
  model: string,
): GeminiToolMetadata | undefined {
  if (!encoded.startsWith(CARRIER_PREFIX)) return
  if (encoded.length > MAX_CARRIER_LENGTH)
    throw new Error("Gemini metadata is too large")
  const encodedPayload = encoded.slice(CARRIER_PREFIX.length)
  if (!/^[\w-]+$/.test(encodedPayload))
    throw new Error("Invalid Gemini metadata encoding")
  const value: unknown = JSON.parse(
    Buffer.from(encodedPayload, "base64url").toString("utf8"),
  )
  if (!validMetadata(value) || value.model !== model) {
    throw new Error("Invalid Gemini metadata or model mismatch")
  }
  validateMetadataBindings(value)
  return value
}

function validCallIds(value: unknown): value is Array<string> {
  return (
    Array.isArray(value)
    && value.every((id: unknown) => typeof id === "string" && id.length > 0)
  )
}

function validMetadata(value: unknown): value is GeminiToolMetadata {
  if (!record(value)) return false
  return (
    (value.kind === "tool" || value.kind === "message")
    && typeof value.model === "string"
    && validCallIds(value.callIds)
    && record(value.fields)
    && (value.functionFields === undefined || record(value.functionFields))
    && (value.messageId === undefined || typeof value.messageId === "string")
  )
}

function validateMetadataBindings(value: GeminiToolMetadata): void {
  const forbidden =
    value.kind === "tool" ?
      ["id", "index", "type", "function"]
    : ["role", "content", "tool_calls", "refusal"]
  forbidden.push("__proto__", "constructor", "prototype")
  if (
    forbidden.some((key) => Object.hasOwn(value.fields, key))
    || (value.functionFields !== undefined
      && ["name", "arguments", "__proto__", "constructor", "prototype"].some(
        (key) => Object.hasOwn(value.functionFields ?? {}, key),
      ))
    || (value.kind === "tool" && value.callIds.length !== 1)
    || (value.kind === "message"
      && value.callIds.length === 0
      && !value.messageId)
  ) {
    throw new Error("Gemini metadata has invalid fields or bindings")
  }
}
