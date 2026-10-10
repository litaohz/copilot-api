import type {
  ReadableStreamDefaultReader,
  ReadableStreamReadResult,
} from "node:stream/web"

const MAX_PREFIX_BYTES = 64 * 1024
const DEFAULT_LOOKAHEAD_MS = 500

interface RejectedRequest {
  code: "invalid_request_body"
  message: string
}

class PrefixReader {
  readonly chunks: Array<Uint8Array> = []
  readonly reader: ReadableStreamDefaultReader<Uint8Array>
  pending?: Promise<ReadableStreamReadResult<Uint8Array>>
  ended = false
  failed = false
  failure: unknown
  text = ""
  bytes = 0
  decoder = new TextDecoder()

  constructor(body: ReadableStream<Uint8Array>) {
    this.reader = body.getReader()
  }

  inspect(chunk: Uint8Array): RejectedRequest | "wait" | "pass" {
    this.chunks.push(chunk)
    this.bytes += chunk.byteLength
    if (this.bytes > MAX_PREFIX_BYTES) return "pass"
    this.text += this.decoder.decode(chunk, { stream: true })
    for (;;) {
      const boundary = /\r?\n\r?\n/.exec(this.text)
      if (!boundary) return "wait"
      const frame = this.text.slice(0, boundary.index)
      this.text = this.text.slice(boundary.index + boundary[0].length)
      const data = frame
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).replace(/^ /, ""))
        .join("\n")
      if (!data) continue
      const result = classifyEvent(data)
      if (result !== "wait") return result
    }
  }

  replay(upstream: Response): Response {
    let index = 0
    return new Response(
      new ReadableStream<Uint8Array>(
        {
          pull: async (controller) => {
            try {
              if (index < this.chunks.length) {
                controller.enqueue(this.chunks[index++])
                return
              }
              if (this.failed) {
                controller.error(this.failure)
                this.reader.releaseLock()
                return
              }
              if (this.ended) {
                controller.close()
                this.reader.releaseLock()
                return
              }
              const result = await (this.pending ?? this.reader.read())
              this.pending = undefined
              if (result.done) {
                controller.close()
                this.reader.releaseLock()
              } else controller.enqueue(result.value)
            } catch (error) {
              controller.error(error)
              this.reader.releaseLock()
            }
          },
          cancel: async (reason) => {
            await this.reader.cancel(reason)
            this.reader.releaseLock()
          },
        },
        { highWaterMark: 0 },
      ),
      { status: upstream.status, headers: upstream.headers },
    )
  }
}

function classifyEvent(data: string): RejectedRequest | "wait" | "pass" {
  let event: unknown
  try {
    event = JSON.parse(data)
  } catch {
    return "pass"
  }
  if (!event || typeof event !== "object" || !("type" in event)) return "pass"
  if (
    event.type === "error"
    && "code" in event
    && event.code === "invalid_request_body"
    && "message" in event
    && typeof event.message === "string"
  ) {
    return { code: event.code, message: event.message }
  }
  return (
      ["response.created", "response.failed", "response.queued"].includes(
        String(event.type),
      )
    ) ?
      "wait"
    : "pass"
}

/** Recover Copilot's error after response.failed, before the client stops reading.
 * Only explicit invalid_request_body before generation becomes HTTP 400.
 * All other streams keep their original bytes, bounded by time and prefix size.
 */
export async function normalizeEarlyResponseFailure(
  upstream: Response,
  lookaheadMs = DEFAULT_LOOKAHEAD_MS,
): Promise<Response> {
  if (
    upstream.status !== 200
    || !upstream.body
    || upstream.headers
      .get("content-type")
      ?.split(";", 1)[0]
      .trim()
      .toLowerCase() !== "text/event-stream"
  )
    return upstream
  const prefix = new PrefixReader(upstream.body)
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<undefined>((resolve) => {
    timer = setTimeout(() => resolve(undefined), lookaheadMs)
  })
  try {
    while (prefix.bytes < MAX_PREFIX_BYTES) {
      prefix.pending = prefix.reader.read()
      const result = await Promise.race([prefix.pending, deadline])
      if (!result) break
      prefix.pending = undefined
      if (result.done) {
        prefix.ended = true
        break
      }
      const decision = prefix.inspect(result.value)
      if (decision === "pass") break
      if (decision === "wait") continue
      void prefix.reader
        .cancel("Upstream rejected the request before generation")
        .catch(() => {})
      const headers = new Headers(upstream.headers)
      headers.set("content-type", "application/json")
      headers.delete("content-length")
      headers.delete("content-encoding")
      return new Response(
        JSON.stringify({
          error: { ...decision, type: "invalid_request_error" },
        }),
        { status: 400, headers },
      )
    }
    return prefix.replay(upstream)
  } catch (error) {
    prefix.failed = true
    prefix.failure = error
    prefix.pending = undefined
    return prefix.replay(upstream)
  } finally {
    clearTimeout(timer)
  }
}
