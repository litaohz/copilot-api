import type {
  GeminiResponseContext,
  GeminiToolMapping,
} from "~/lib/responses/gemini-types"

import {
  encodeGeminiMessageMetadata,
  encodeGeminiToolMetadata,
} from "~/lib/responses/gemini-metadata"

type JsonObject = Record<string, unknown>
type ResponseStatus = "in_progress" | "completed" | "incomplete" | "failed"

interface TextItem {
  kind: "text" | "refusal"
  id: string
  index: number
  text: string
}

interface ToolItem {
  kind: "tool"
  id: string
  index: number
  callId: string
  name: string
  arguments: string
  sent: string
  mapping?: GeminiToolMapping
  raw: JsonObject
  added: boolean
}

type OutputItem = TextItem | ToolItem

const encoder = new TextEncoder()

function object(value: unknown): JsonObject | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ?
      (value as JsonObject)
    : undefined
}

function identifier(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`
}

function mergeMetadata(target: JsonObject, source: JsonObject): void {
  for (const [key, value] of Object.entries(source)) {
    if (["__proto__", "constructor", "prototype"].includes(key))
      throw new Error("Gemini returned unsafe tool metadata.")
    const child = object(value)
    if (child) {
      const current =
        (Object.hasOwn(target, key) ? object(target[key]) : undefined) ?? {}
      mergeMetadata(current, child)
      target[key] = current
    } else target[key] = value
  }
}

/** Decode only complete characters from the JSON string in {"input":"..."}. */
function customInputPrefix(argumentsText: string): string {
  const start = /^\s*\{\s*"input"\s*:\s*"/u.exec(argumentsText)
  if (!start) return ""
  const text = argumentsText.slice(start[0].length)
  let end = 0
  while (end < text.length) {
    if (text[end] === '"') break
    if (text[end] === "\\") {
      if (end + 1 >= text.length) break
      if (text[end + 1] === "u") {
        if (end + 6 > text.length) break
        end += 6
      } else end += 2
    } else end++
  }
  const decoded = JSON.parse(`"${text.slice(0, end)}"`) as string
  const last = decoded.codePointAt(decoded.length - 1)
  return last !== undefined && last >= 0xd800 && last <= 0xdbff ?
      decoded.slice(0, -1)
    : decoded
}

function customInput(argumentsText: string): string {
  const parsed = object(JSON.parse(argumentsText))
  if (
    !parsed
    || Object.keys(parsed).length !== 1
    || typeof parsed.input !== "string"
    || !parsed.input.isWellFormed()
  )
    throw new Error("Gemini returned invalid custom tool input.")
  return parsed.input
}

function textPart(item: TextItem): JsonObject {
  if (item.kind === "refusal") return { type: "refusal", refusal: item.text }
  return { type: "output_text", text: item.text, annotations: [], logprobs: [] }
}

function toolInput(item: ToolItem, final: boolean): string {
  if (item.mapping?.type === "custom") {
    if (final) return customInput(item.arguments)
    return customInputPrefix(item.arguments)
  }
  if (final) {
    if (!item.arguments) item.arguments = "{}"
    if (!object(JSON.parse(item.arguments)))
      throw new Error("Gemini returned invalid function tool arguments.")
  }
  return item.arguments
}

class ResponseTranslation {
  readonly id = identifier("resp")
  readonly createdAt = Math.floor(Date.now() / 1000)
  readonly events: Array<JsonObject> = []
  readonly items: Array<OutputItem> = []
  readonly tools = new Map<number, ToolItem>()
  readonly carriers: Array<JsonObject> = []
  private sequence = 0
  private usage: JsonObject | null = null
  private finishReason: string | undefined
  private refusal = false
  private opaque = ""
  private reasoningContent = ""
  private ended = false
  private status: ResponseStatus = "in_progress"
  private error: JsonObject | null = null
  private incompleteDetails: JsonObject | null = null
  private readonly context: GeminiResponseContext

  constructor(context: GeminiResponseContext) {
    this.context = context
    this.emit("response.created", { response: this.snapshot() })
    this.emit("response.in_progress", { response: this.snapshot() })
  }

  get complete(): boolean {
    return this.ended
  }

  emit(type: string, fields: JsonObject): void {
    this.events.push({ type, sequence_number: this.sequence++, ...fields })
  }

  snapshot(): JsonObject {
    return {
      ...this.context.responseFields,
      id: this.id,
      object: "response",
      created_at: this.createdAt,
      model: this.context.model,
      status: this.status,
      error: this.error,
      incomplete_details: this.incompleteDetails,
      output: [
        ...this.items.map((item) => this.output(item)),
        ...this.carriers,
      ],
      usage: this.usage,
      store: false,
    }
  }

  private output(item: OutputItem): JsonObject {
    const status = this.itemStatus()
    if (item.kind !== "tool")
      return {
        id: item.id,
        type: "message",
        status,
        role: "assistant",
        content: [textPart(item)],
      }
    const mapping = item.mapping
    return {
      id: item.id,
      type: mapping?.type === "custom" ? "custom_tool_call" : "function_call",
      status,
      call_id: item.callId,
      name: mapping?.name ?? item.name,
      ...(mapping?.namespace ? { namespace: mapping.namespace } : {}),
      ...(mapping?.type === "custom" ?
        { input: item.sent }
      : { arguments: item.arguments }),
    }
  }

  private itemStatus(): string {
    if (this.status === "in_progress") return "in_progress"
    if (this.status === "completed") return "completed"
    return "incomplete"
  }

  private addText(kind: TextItem["kind"], delta: string): void {
    if (!delta) return
    let item = this.items.find(
      (entry): entry is TextItem => entry.kind === kind,
    )
    if (!item) {
      item = {
        kind,
        id: identifier("msg"),
        index: this.items.length,
        text: "",
      }
      this.items.push(item)
      this.emit("response.output_item.added", {
        output_index: item.index,
        item: this.output(item),
      })
      this.emit("response.content_part.added", {
        item_id: item.id,
        output_index: item.index,
        content_index: 0,
        part: textPart(item),
      })
    }
    item.text += delta
    this.refusal ||= kind === "refusal"
    this.emit(
      kind === "refusal" ?
        "response.refusal.delta"
      : "response.output_text.delta",
      {
        item_id: item.id,
        output_index: item.index,
        content_index: 0,
        delta,
        ...(kind === "text" ? { logprobs: [] } : {}),
      },
    )
  }

  private addTool(delta: JsonObject, fallbackIndex: number): void {
    const index = delta.index ?? fallbackIndex
    if (!Number.isInteger(index) || (index as number) < 0)
      throw new Error("Gemini returned an invalid tool call index.")
    let item = this.tools.get(index as number)
    if (!item) {
      item = {
        kind: "tool",
        id: identifier("fc"),
        index: this.items.length,
        callId:
          typeof delta.id === "string" && delta.id ?
            delta.id
          : identifier("call"),
        name: "",
        arguments: "",
        sent: "",
        raw: {},
        added: false,
      }
      this.items.push(item)
      this.tools.set(index as number, item)
    }
    const fn = object(delta.function)
    if (typeof fn?.name === "string") item.name += fn.name
    if (typeof fn?.arguments === "string") item.arguments += fn.arguments
    mergeMetadata(item.raw, delta)
    this.flushTool(item)
  }

  private startTool(item: ToolItem): void {
    const mapping =
      Object.hasOwn(this.context.tools, item.name) ?
        this.context.tools[item.name]
      : undefined
    if (!mapping) throw new Error("Gemini returned an unknown tool name.")
    item.mapping = mapping
    item.added = true
    this.emit("response.output_item.added", {
      output_index: item.index,
      item: {
        ...this.output(item),
        ...(mapping.type === "custom" ? { input: "" } : { arguments: "" }),
      },
    })
  }

  private flushTool(item: ToolItem, final = false): void {
    if (!item.added) {
      if (!item.arguments && !final) return
      this.startTool(item)
    }
    const text = toolInput(item, final)
    if (!text.startsWith(item.sent))
      throw new Error("Gemini changed an already streamed tool input.")
    const delta = text.slice(item.sent.length)
    item.sent = text
    if (delta)
      this.emit(
        item.mapping?.type === "custom" ?
          "response.custom_tool_call_input.delta"
        : "response.function_call_arguments.delta",
        { item_id: item.id, output_index: item.index, delta },
      )
  }

  private updateUsage(usage: JsonObject): void {
    const input = numeric(usage.prompt_tokens)
    const output = numeric(usage.completion_tokens)
    this.usage = {
      input_tokens: input,
      input_tokens_details: {
        cached_tokens: numeric(
          object(usage.prompt_tokens_details)?.cached_tokens,
        ),
      },
      output_tokens: output,
      output_tokens_details: {
        reasoning_tokens: numeric(
          object(usage.completion_tokens_details)?.reasoning_tokens
            ?? usage.reasoning_tokens,
        ),
      },
      total_tokens:
        typeof usage.total_tokens === "number" ?
          usage.total_tokens
        : input + output,
    }
  }

  private acceptDelta(delta: JsonObject): void {
    for (const [field, kind] of [
      ["content", "text"],
      ["refusal", "refusal"],
    ] as const) {
      const text = delta[field]
      if (typeof text === "string") this.addText(kind, text)
      else if (text !== null && text !== undefined)
        throw new Error("Gemini returned unsupported assistant content.")
    }
    if (typeof delta.reasoning_opaque === "string")
      this.opaque += delta.reasoning_opaque
    if (typeof delta.reasoning_content === "string")
      this.reasoningContent += delta.reasoning_content
    if (!Array.isArray(delta.tool_calls)) return
    for (const [index, tool] of delta.tool_calls.entries()) {
      const raw = object(tool)
      if (!raw) throw new Error("Gemini returned an invalid tool call.")
      this.addTool(raw, index)
    }
  }

  accept(value: unknown, streaming: boolean): void {
    const chunk = object(value)
    if (!chunk)
      throw new Error("Gemini returned an invalid Chat Completions response.")
    if (chunk.error) throw new Error("Gemini returned an upstream error.")
    const usage = object(chunk.usage)
    if (usage) this.updateUsage(usage)
    if (!Array.isArray(chunk.choices))
      throw new Error("Gemini response is missing Chat Completions choices.")
    for (const entry of chunk.choices) {
      const choice = object(entry)
      if (!choice || (choice.index !== undefined && choice.index !== 0))
        throw new Error("Gemini returned an unsupported completion choice.")
      const delta = object(streaming ? choice.delta : choice.message)
      if (delta) this.acceptDelta(delta)
      if (typeof choice.finish_reason === "string")
        this.finishReason = choice.finish_reason
    }
  }

  private validateFinish(): void {
    if (!this.finishReason)
      throw new Error("Gemini stream ended without a completion finish reason.")
    if (
      !["content_filter", "length", "stop", "tool_calls"].includes(
        this.finishReason,
      )
    )
      throw new Error("Gemini returned an unsupported finish reason.")
    for (const tool of this.tools.values()) this.flushTool(tool, true)
    if (this.finishReason === "stop" && this.items.length === 0)
      throw new Error("Gemini completed without assistant output.")
    if (this.finishReason === "tool_calls" && this.tools.size === 0)
      throw new Error("Gemini completed tool calling without a tool call.")
  }

  finish(): void {
    if (this.ended) return
    this.validateFinish()
    this.status =
      (
        this.finishReason === "length"
        || this.finishReason === "content_filter"
        || this.refusal
      ) ?
        "incomplete"
      : "completed"
    if (this.status === "incomplete")
      this.incompleteDetails = {
        reason:
          this.finishReason === "length" ?
            "max_output_tokens"
          : "content_filter",
      }
    for (const item of this.items) this.closeItem(item)
    this.addMetadata()
    this.ended = true
    this.emit(
      this.status === "completed" ?
        "response.completed"
      : "response.incomplete",
      { response: this.snapshot() },
    )
  }

  private addMetadata(): void {
    if (this.items.length === 0) return
    for (const tool of this.tools.values()) {
      const carrier = encodeGeminiToolMetadata(
        this.context.model,
        tool.callId,
        tool.raw,
      )
      if (carrier) this.addCarrier(carrier)
    }
    if (this.opaque || this.reasoningContent) {
      const carrier = encodeGeminiMessageMetadata(
        this.context.model,
        [...this.tools.values()].map((tool) => tool.callId),
        {
          ...(this.opaque ? { reasoning_opaque: this.opaque } : {}),
          ...(this.reasoningContent ?
            { reasoning_content: this.reasoningContent }
          : {}),
        },
        this.tools.size > 0 ?
          undefined
        : this.items.find(
            (item) => item.kind === "text" || item.kind === "refusal",
          )?.id,
      )
      if (carrier) this.addCarrier(carrier)
    }
  }

  private addCarrier(encryptedContent: string): void {
    const item = {
      id: identifier("rs"),
      type: "reasoning",
      summary: [],
      encrypted_content: encryptedContent,
    }
    const index = this.items.length + this.carriers.length
    this.carriers.push(item)
    this.emit("response.output_item.added", { output_index: index, item })
    this.emit("response.output_item.done", { output_index: index, item })
  }

  private closeItem(item: OutputItem): void {
    if (item.kind === "tool") {
      this.emit(
        item.mapping?.type === "custom" ?
          "response.custom_tool_call_input.done"
        : "response.function_call_arguments.done",
        {
          item_id: item.id,
          output_index: item.index,
          ...(item.mapping?.type === "custom" ?
            { input: item.sent }
          : { arguments: item.arguments }),
        },
      )
    } else {
      this.emit(
        item.kind === "refusal" ?
          "response.refusal.done"
        : "response.output_text.done",
        {
          item_id: item.id,
          output_index: item.index,
          content_index: 0,
          ...(item.kind === "refusal" ?
            { refusal: item.text }
          : { text: item.text }),
        },
      )
      this.emit("response.content_part.done", {
        item_id: item.id,
        output_index: item.index,
        content_index: 0,
        part: textPart(item),
      })
    }
    this.emit("response.output_item.done", {
      output_index: item.index,
      item: this.output(item),
    })
  }

  fail(error: unknown): void {
    if (this.ended) return
    this.status = "failed"
    this.error = {
      code: "gemini_bridge_error",
      message:
        error instanceof Error ?
          error.message
        : "Gemini response conversion failed.",
    }
    this.ended = true
    this.emit("response.failed", { response: this.snapshot() })
  }
}

function numeric(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ?
      value
    : 0
}

function headers(upstream: Response, streaming: boolean): Headers {
  const result = new Headers({
    "content-type":
      streaming ? "text/event-stream; charset=utf-8" : "application/json",
  })
  for (const name of ["cache-control", "x-request-id"]) {
    const value = upstream.headers.get(name)
    if (value) result.set(name, value)
  }
  return result
}

function eventBytes(event: JsonObject): Uint8Array {
  return encoder.encode(
    `event: ${String(event.type)}\ndata: ${JSON.stringify(event)}\n\n`,
  )
}

interface ByteReader {
  read(): Promise<{ done?: boolean; value?: Uint8Array }>
  cancel(reason?: unknown): Promise<void>
}

class ChatStreamFrames {
  private readonly reader: ByteReader | undefined
  private readonly decoder = new TextDecoder()
  private buffer = ""

  constructor(upstream: Response) {
    this.reader = upstream.body?.getReader() as ByteReader | undefined
  }

  private takeFrame(): string | undefined {
    const separator = /\r?\n\r?\n/u.exec(this.buffer)
    if (!separator) return
    const frame = this.buffer.slice(0, separator.index)
    this.buffer = this.buffer.slice(separator.index + separator[0].length)
    return frame
      .split(/\r?\n/u)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).replace(/^ /u, ""))
      .join("\n")
  }

  async next(): Promise<string> {
    while (true) {
      const frame = this.takeFrame()
      if (frame !== undefined) return frame
      const chunk = await this.reader?.read()
      if (!chunk || chunk.done || !chunk.value)
        throw new Error("Gemini stream ended before its [DONE] marker.")
      this.buffer += this.decoder.decode(chunk.value, { stream: true })
    }
  }

  async cancel(reason?: unknown): Promise<void> {
    await this.reader?.cancel(reason)
  }
}

function translateStream(
  upstream: Response,
  context: GeminiResponseContext,
): Response {
  const state = new ResponseTranslation(context)
  const frames = new ChatStreamFrames(upstream)
  let cancelled = false
  const isCancelled = () => cancelled
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        while (state.events.length === 0 && !state.complete && !isCancelled()) {
          const data = await frames.next()
          if (isCancelled()) return
          if (data === "[DONE]") {
            state.finish()
            await frames.cancel()
          } else if (data) state.accept(JSON.parse(data) as unknown, true)
        }
      } catch (error) {
        if (cancelled) return
        state.fail(error)
        await frames.cancel(error).catch(() => undefined)
      }
      if (cancelled) return
      const event = state.events.shift()
      if (event) controller.enqueue(eventBytes(event))
      else if (state.complete) controller.close()
    },
    async cancel(reason) {
      cancelled = true
      await frames.cancel(reason)
    },
  })
  return new Response(stream, {
    status: upstream.status,
    headers: headers(upstream, true),
  })
}

export async function translateGeminiResponse(
  upstream: Response,
  context: GeminiResponseContext,
): Promise<Response> {
  if (!upstream.ok) return upstream
  const isSse =
    upstream.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase()
    === "text/event-stream"
  if (isSse && context.stream) return translateStream(upstream, context)
  const state = new ResponseTranslation(context)
  try {
    if (isSse) {
      const translated = translateStream(upstream, { ...context, stream: true })
      const text = await translated.text()
      const events = text.split("\n\n").filter(Boolean)
      const last = JSON.parse(
        events.at(-1)?.split("\ndata: ")[1] ?? "{}",
      ) as JsonObject
      return Response.json(last.response, { headers: headers(upstream, false) })
    }
    state.accept(await upstream.json(), false)
    state.finish()
  } catch (error) {
    state.fail(error)
  }
  if (!context.stream)
    return Response.json(state.snapshot(), {
      headers: headers(upstream, false),
    })
  return new Response(
    state.events
      .map((event) => new TextDecoder().decode(eventBytes(event)))
      .join(""),
    {
      headers: headers(upstream, true),
    },
  )
}
