import { createHash } from "node:crypto"

import type {
  GeminiBridgeRequest,
  GeminiToolMapping,
} from "~/lib/responses/gemini-types"

import {
  decodeGeminiToolMetadata,
  type GeminiToolMetadata,
} from "./gemini-metadata"

export class GeminiRequestError extends Error {
  readonly status = 400
  readonly param?: string

  constructor(message: string, param?: string) {
    super(message)
    this.name = "GeminiRequestError"
    this.param = param
  }
}

type JsonRecord = Record<string, unknown>
interface TranslationState {
  model: string
  tools: Record<string, GeminiToolMapping>
  names: Map<string, string>
  messages: Array<JsonRecord>
  calls: Map<string, { call: JsonRecord; message: JsonRecord }>
  items: Map<string, JsonRecord>
  metadata: Array<GeminiToolMetadata>
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function object(value: unknown, param: string): JsonRecord {
  if (!isRecord(value))
    throw new GeminiRequestError(`${param} must be an object`, param)
  return value
}

function string(value: unknown, param: string): string {
  if (typeof value !== "string")
    throw new GeminiRequestError(`${param} must be a string`, param)
  return value
}

function unsupported(param: string): never {
  throw new GeminiRequestError(
    `Gemini Responses bridge does not support ${param}`,
    param,
  )
}

function toolKey(type: string, name: string, namespace?: string): string {
  return JSON.stringify([type, namespace ?? null, name])
}

function registerTool(
  state: TranslationState,
  mapping: GeminiToolMapping,
): string {
  const key = toolKey(mapping.type, mapping.name, mapping.namespace)
  const existing = state.names.get(key)
  if (existing) return existing
  const simple =
    mapping.type === "function"
    && !mapping.namespace
    && /^[\w-]{1,64}$/.test(mapping.name)
    && !mapping.name.startsWith("gb_")
  const name =
    simple ?
      mapping.name
    : `gb_${createHash("sha256").update(key).digest("hex").slice(0, 40)}`
  const collision = state.tools[name]
  if (
    Object.hasOwn(state.tools, name)
    && toolKey(collision.type, collision.name, collision.namespace) !== key
  ) {
    throw new GeminiRequestError("Tool name collision", "tools")
  }
  state.names.set(key, name)
  state.tools[name] = mapping
  return name
}

function toolParameters(tool: JsonRecord): JsonRecord {
  if (tool.type === "custom")
    return {
      type: "object",
      properties: { input: { type: "string" } },
      required: ["input"],
      additionalProperties: false,
    }
  if (tool.parameters === undefined) return { type: "object", properties: {} }
  return object(tool.parameters, "tools.parameters")
}

function translateTools(
  value: unknown,
  state: TranslationState,
  namespace?: string,
): Array<JsonRecord> {
  if (value === undefined) return []
  if (!Array.isArray(value))
    throw new GeminiRequestError("tools must be an array", "tools")
  return value.flatMap((entry: unknown): Array<JsonRecord> => {
    const tool = object(entry, "tools")
    if (tool.type === "namespace") {
      if (namespace) unsupported("nested tool namespaces")
      const name = string(tool.name, "tools.name")
      if (!name) unsupported("empty tool namespace")
      return translateTools(tool.tools, state, name)
    }
    if (tool.type !== "function" && tool.type !== "custom")
      unsupported(`tools.type=${String(tool.type)}`)
    const name = string(tool.name, "tools.name")
    if (!name)
      throw new GeminiRequestError("Tool names cannot be empty", "tools.name")
    const mapping: GeminiToolMapping = {
      type: tool.type,
      name,
      ...(namespace ? { namespace } : {}),
    }
    if (state.names.has(toolKey(mapping.type, name, namespace))) {
      throw new GeminiRequestError(`Duplicate tool ${name}`, "tools")
    }
    if (tool.type === "custom" && tool.format !== undefined) {
      const format = object(tool.format, "tools.format")
      if (format.type !== "text") unsupported("custom tool grammar/format")
    }
    const parameters = toolParameters(tool)
    return [
      {
        type: "function",
        function: {
          name: registerTool(state, mapping),
          parameters,
          ...(tool.description === undefined ?
            {}
          : { description: string(tool.description, "tools.description") }),
          ...(tool.strict === undefined ? {} : { strict: tool.strict }),
        },
      },
    ]
  })
}

function content(
  value: unknown,
  param: string,
  allowImages: boolean,
): string | Array<JsonRecord> {
  if (typeof value === "string") return value
  if (!Array.isArray(value))
    throw new GeminiRequestError(
      `${param} must be a string or content array`,
      param,
    )
  const parts = value.map((entry: unknown): JsonRecord => {
    const part = object(entry, param)
    if (["input_text", "output_text", "text"].includes(String(part.type))) {
      return { type: "text", text: string(part.text, `${param}.text`) }
    }
    if (part.type === "refusal")
      return { type: "text", text: string(part.refusal, `${param}.refusal`) }
    if (part.type === "input_image" && allowImages) {
      if (part.file_id !== undefined) unsupported(`${param}.file_id`)
      const url = string(part.image_url, `${param}.image_url`)
      if (!/^(?:https?:\/\/|data:image\/)/i.test(url))
        unsupported(`${param}.image_url scheme`)
      if (
        part.detail !== undefined
        && (typeof part.detail !== "string"
          || !["auto", "high", "low"].includes(part.detail))
      )
        unsupported(`${param}.detail`)
      return {
        type: "image_url",
        image_url: { url, ...(part.detail ? { detail: part.detail } : {}) },
      }
    }
    return unsupported(`${param}.type=${String(part.type)}`)
  })
  return parts.every((part) => part.type === "text") ?
      parts.map((part) => part.text).join("")
    : parts
}

function assistantForCalls(state: TranslationState): JsonRecord {
  const last = state.messages.at(-1)
  if (last?.role === "assistant") return last
  const message: JsonRecord = {
    role: "assistant",
    content: null,
    tool_calls: [],
  }
  state.messages.push(message)
  return message
}

function reasoningInput(item: JsonRecord, state: TranslationState): void {
  if (item.type === "reasoning") {
    if (
      item.encrypted_content !== undefined
      && item.encrypted_content !== null
    ) {
      const encrypted = string(
        item.encrypted_content,
        "input.encrypted_content",
      )
      let metadata: GeminiToolMetadata | undefined
      try {
        metadata = decodeGeminiToolMetadata(encrypted, state.model)
      } catch {
        throw new GeminiRequestError(
          "Invalid Gemini reasoning metadata or model mismatch",
          "input.encrypted_content",
        )
      }
      if (!metadata) unsupported("foreign encrypted reasoning")
      state.metadata.push(metadata)
      return
    }
    return unsupported("reasoning input without Gemini metadata")
  }
}

function callInput(item: JsonRecord, state: TranslationState): void {
  if (item.type === "function_call" || item.type === "custom_tool_call") {
    const callId = string(item.call_id, "input.call_id")
    if (!callId || state.calls.has(callId))
      throw new GeminiRequestError(
        "Duplicate or empty tool call_id",
        "input.call_id",
      )
    const name = string(item.name, "input.name")
    const namespace =
      item.namespace === undefined ?
        undefined
      : string(item.namespace, "input.namespace")
    const type = item.type === "custom_tool_call" ? "custom" : "function"
    const toolName = registerTool(state, {
      type,
      name,
      ...(namespace ? { namespace } : {}),
    })
    const args =
      type === "custom" ?
        JSON.stringify({ input: string(item.input, "input.input") })
      : string(item.arguments, "input.arguments")
    const call: JsonRecord = {
      id: callId,
      type: "function",
      function: { name: toolName, arguments: args },
    }
    const message = assistantForCalls(state)
    const calls =
      Array.isArray(message.tool_calls) ?
        (message.tool_calls as Array<JsonRecord>)
      : []
    calls.push(call)
    message.tool_calls = calls
    state.calls.set(callId, { call, message })
    return
  }
}

function outputInput(item: JsonRecord, state: TranslationState): void {
  if (
    item.type === "function_call_output"
    || item.type === "custom_tool_call_output"
  ) {
    const id = string(item.call_id, "input.call_id")
    if (!state.calls.has(id))
      throw new GeminiRequestError(
        "Tool output has no preceding tool call; send complete input history",
        "input.call_id",
      )
    state.messages.push({
      role: "tool",
      tool_call_id: id,
      content: content(item.output, "input.output", false),
    })
    return
  }
}

function messageInput(item: JsonRecord, state: TranslationState): void {
  if (
    (item.type === "message" || item.type === undefined)
    && typeof item.role === "string"
  ) {
    if (!["assistant", "developer", "system", "user"].includes(item.role))
      unsupported(`input.role=${item.role}`)
    const message: JsonRecord = {
      role: item.role === "developer" ? "system" : item.role,
      content: content(item.content, "input.content", item.role === "user"),
    }
    const previous = state.messages.at(-1)
    if (
      item.role === "assistant"
      && previous?.role === "assistant"
      && Array.isArray(previous.tool_calls)
    ) {
      previous.content = mergeContent(previous.content, message.content)
      if (typeof item.id === "string") state.items.set(item.id, previous)
      return
    }
    state.messages.push(message)
    if (typeof item.id === "string") state.items.set(item.id, message)
    return
  }
  unsupported(`input.type=${String(item.type)}`)
}

function mergeContent(first: unknown, second: unknown): unknown {
  if (first === null || first === undefined) return second
  if (typeof first === "string" && typeof second === "string")
    return first + second
  const firstParts =
    typeof first === "string" ? [{ type: "text", text: first }] : first
  const secondParts =
    typeof second === "string" ? [{ type: "text", text: second }] : second
  if (!Array.isArray(firstParts) || !Array.isArray(secondParts))
    unsupported("assistant content")
  return [...(firstParts as Array<unknown>), ...(secondParts as Array<unknown>)]
}

function inputItem(value: unknown, state: TranslationState): void {
  const item = object(value, "input")
  switch (item.type) {
    case "reasoning": {
      reasoningInput(item, state)
      return
    }
    case "function_call":
    case "custom_tool_call": {
      callInput(item, state)
      return
    }
    case "function_call_output":
    case "custom_tool_call_output": {
      outputInput(item, state)
      return
    }
    default: {
      messageInput(item, state)
      return
    }
  }
}

function applyMetadata(state: TranslationState): void {
  for (const metadata of state.metadata) {
    if (metadata.kind === "tool") {
      const target = state.calls.get(metadata.callIds[0])
      if (!target) unsupported("Gemini metadata without its tool call")
      Object.assign(target.call, metadata.fields)
      Object.assign(
        object(target.call.function, "input.function"),
        metadata.functionFields,
      )
      continue
    }
    const messages = new Set(
      metadata.callIds.map((id) => state.calls.get(id)?.message),
    )
    if (metadata.messageId) messages.add(state.items.get(metadata.messageId))
    if (messages.size !== 1 || messages.has(undefined))
      unsupported("Gemini metadata without its assistant message")
    const message = messages.values().next().value
    if (!message || message.role !== "assistant")
      unsupported("Gemini metadata for a non-assistant message")
    Object.assign(message, metadata.fields)
  }
}

function translateToolChoice(
  value: unknown,
  state: TranslationState,
  declaredTools: ReadonlySet<string>,
): unknown {
  if (typeof value === "string" && ["auto", "none", "required"].includes(value))
    return value
  const choice = object(value, "tool_choice")
  if (choice.type !== "function" && choice.type !== "custom")
    unsupported("tool_choice.type")
  const name = string(choice.name, "tool_choice.name")
  const namespace =
    choice.namespace === undefined ?
      undefined
    : string(choice.namespace, "tool_choice.namespace")
  const mapped = state.names.get(toolKey(choice.type, name, namespace))
  if (!mapped || !declaredTools.has(mapped))
    throw new GeminiRequestError(
      "tool_choice must name a declared tool",
      "tool_choice",
    )
  return { type: "function", function: { name: mapped } }
}

function toolSettings(
  input: JsonRecord,
  tools: Array<JsonRecord>,
  state: TranslationState,
): JsonRecord {
  const settings: JsonRecord = tools.length > 0 ? { tools } : {}
  if (input.parallel_tool_calls !== undefined) {
    if (typeof input.parallel_tool_calls !== "boolean")
      throw new GeminiRequestError(
        "parallel_tool_calls must be boolean",
        "parallel_tool_calls",
      )
    if (tools.length > 0)
      settings.parallel_tool_calls = input.parallel_tool_calls
  }
  const value = input.tool_choice
  if (value === undefined || value === null) return settings
  // Historical calls register names for replay; only this request's declarations count.
  const declaredTools = new Set(
    tools.map((tool) =>
      string(
        object(tool.function, "tools.function").name,
        "tools.function.name",
      ),
    ),
  )
  const choice = translateToolChoice(value, state, declaredTools)
  if (tools.length > 0) return { ...settings, tool_choice: choice }
  // With no callable tools, auto/none both mean a normal text completion.
  if (choice === "auto" || choice === "none") return {}
  throw new GeminiRequestError(
    "tool_choice requires at least one declared tool",
    "tool_choice",
  )
}

function samplingSettings(input: JsonRecord, payload: JsonRecord): void {
  for (const key of ["temperature", "top_p"] as const) {
    if (input[key] !== undefined && input[key] !== null) {
      const value = input[key]
      if (
        typeof value !== "number"
        || !Number.isFinite(value)
        || value < 0
        || value > (key === "top_p" ? 1 : 2)
      ) {
        throw new GeminiRequestError(`Invalid ${key}`, key)
      }
      payload[key] = value
    }
  }
  if (
    input.max_output_tokens !== undefined
    && input.max_output_tokens !== null
  ) {
    if (
      !Number.isSafeInteger(input.max_output_tokens)
      || Number(input.max_output_tokens) <= 0
    ) {
      throw new GeminiRequestError(
        "max_output_tokens must be a positive integer",
        "max_output_tokens",
      )
    }
    payload.max_tokens = input.max_output_tokens
  }
}

function reasoningSettings(input: JsonRecord, payload: JsonRecord): void {
  if (input.reasoning !== undefined && input.reasoning !== null) {
    const reasoning = object(input.reasoning, "reasoning")
    if (reasoning.effort !== undefined && reasoning.effort !== null) {
      if (
        typeof reasoning.effort !== "string"
        || !["high", "low", "medium"].includes(reasoning.effort)
      ) {
        throw new GeminiRequestError(
          "Gemini reasoning.effort must be low, medium, or high",
          "reasoning.effort",
        )
      }
      payload.reasoning_effort = reasoning.effort
    }
    if (
      reasoning.summary !== undefined
      && reasoning.summary !== null
      && (typeof reasoning.summary !== "string"
        || !["auto", "none"].includes(reasoning.summary))
    )
      unsupported("reasoning.summary")
    for (const key of Object.keys(reasoning))
      if (!["effort", "summary"].includes(key)) unsupported(`reasoning.${key}`)
  }
}

function textSettings(input: JsonRecord, payload: JsonRecord): void {
  if (input.text !== undefined && input.text !== null) {
    const text = object(input.text, "text")
    if (text.verbosity !== undefined) unsupported("text.verbosity")
    if (text.format !== undefined) {
      const format = object(text.format, "text.format")
      if (format.type === "json_object")
        payload.response_format = { type: "json_object" }
      else if (format.type === "json_schema") {
        payload.response_format = {
          type: "json_schema",
          json_schema: {
            name: string(format.name, "text.format.name"),
            schema: object(format.schema, "text.format.schema"),
            ...(format.description === undefined ?
              {}
            : {
                description: string(
                  format.description,
                  "text.format.description",
                ),
              }),
            ...(format.strict === undefined ? {} : { strict: format.strict }),
          },
        }
      } else if (format.type !== "text") unsupported("text.format.type")
    }
  }
}

function translateSettings(input: JsonRecord, payload: JsonRecord): void {
  samplingSettings(input, payload)
  reasoningSettings(input, payload)
  textSettings(input, payload)
}

function validateInclude(value: unknown): void {
  if (value === undefined) return
  if (
    !Array.isArray(value)
    || !value.every((entry: unknown) => entry === "reasoning.encrypted_content")
  )
    unsupported("include")
}

function validateStatelessFields(input: JsonRecord): void {
  for (const key of [
    "previous_response_id",
    "conversation",
    "prompt",
  ] as const) {
    if (input[key] !== undefined && input[key] !== null) unsupported(key)
  }
  for (const key of ["store", "background"] as const) {
    if (input[key] !== undefined && input[key] !== false && input[key] !== null)
      unsupported(`${key}=true`)
  }
  if (input.truncation !== undefined && input.truncation !== "disabled")
    unsupported("truncation")
  if (
    input.service_tier !== undefined
    && (typeof input.service_tier !== "string"
      || !["auto", "default"].includes(input.service_tier))
  )
    unsupported("service_tier")
  validateInclude(input.include)
  // Codex client diagnostics are transport metadata, not model input.
  if (input.client_metadata !== undefined)
    object(input.client_metadata, "client_metadata")
  const supported = new Set([
    "model",
    "input",
    "instructions",
    "stream",
    "tools",
    "tool_choice",
    "parallel_tool_calls",
    "max_output_tokens",
    "temperature",
    "top_p",
    "text",
    "reasoning",
    "metadata",
    "client_metadata",
    "user",
    "store",
    "background",
    "include",
    "prompt_cache_key",
    "prompt_cache_retention",
    "safety_identifier",
    "truncation",
    "service_tier",
    "previous_response_id",
    "conversation",
    "prompt",
  ])
  for (const key of Object.keys(input))
    if (!supported.has(key)) unsupported(key)
}

export function translateGeminiRequest(bodyText: string): GeminiBridgeRequest {
  let parsed: unknown
  try {
    parsed = JSON.parse(bodyText) as unknown
  } catch {
    throw new GeminiRequestError("Invalid JSON request body")
  }
  const input = object(parsed, "request")
  const model = string(input.model, "model")
  if (!model.startsWith("gemini-"))
    throw new GeminiRequestError(
      "Gemini bridge requires a gemini-* model",
      "model",
    )
  if (input.stream !== undefined && typeof input.stream !== "boolean")
    throw new GeminiRequestError("stream must be boolean", "stream")
  validateStatelessFields(input)
  const state: TranslationState = {
    model,
    tools: Object.create(null) as Record<string, GeminiToolMapping>,
    names: new Map(),
    messages: [],
    calls: new Map(),
    items: new Map(),
    metadata: [],
  }
  const tools = translateTools(input.tools, state)
  if (input.instructions !== undefined && input.instructions !== null)
    state.messages.push({
      role: "system",
      content: string(input.instructions, "instructions"),
    })
  if (typeof input.input === "string")
    state.messages.push({ role: "user", content: input.input })
  else if (Array.isArray(input.input))
    for (const item of input.input) inputItem(item, state)
  else
    throw new GeminiRequestError(
      "input must be a string or an array of complete input items",
      "input",
    )
  if (state.messages.length === 0)
    throw new GeminiRequestError("input cannot be empty", "input")
  applyMetadata(state)
  const stream = input.stream === true
  const payload: JsonRecord = {
    model,
    messages: state.messages,
    stream,
    ...toolSettings(input, tools, state),
  }
  if (stream) payload.stream_options = { include_usage: true }
  if (input.user !== undefined) payload.user = string(input.user, "user")
  translateSettings(input, payload)
  const responseFields = Object.fromEntries(
    [
      "instructions",
      "metadata",
      "parallel_tool_calls",
      "max_output_tokens",
      "text",
      "reasoning",
      "temperature",
      "top_p",
    ]
      .filter((key) => input[key] !== undefined)
      .map((key) => [key, input[key]]),
  )
  return {
    payload,
    context: { model, stream, tools: state.tools, responseFields },
  }
}
