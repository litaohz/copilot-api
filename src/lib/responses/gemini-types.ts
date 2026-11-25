export interface GeminiToolMapping {
  type: "function" | "custom"
  name: string
  namespace?: string
}

export interface GeminiResponseContext {
  model: string
  stream: boolean
  tools: Record<string, GeminiToolMapping>
  responseFields: Record<string, unknown>
}

export interface GeminiBridgeRequest {
  payload: Record<string, unknown>
  context: GeminiResponseContext
}
