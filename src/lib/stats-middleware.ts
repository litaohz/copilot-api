import type { Context, Next } from "hono"

import type { RequestRecord } from "./stats"

import { extractUsage, getClientIp, isApiPath, stats } from "./stats"

const TOKEN_ENDPOINTS = [
  "/chat/completions",
  "/responses",
  "/messages",
  "/embeddings",
]

function isTokenEndpoint(path: string): boolean {
  return TOKEN_ENDPOINTS.some((p) => path === p || path.endsWith(p))
}

async function peekModel(c: Context): Promise<string | undefined> {
  if (c.req.method !== "POST") return undefined
  try {
    const text = await c.req.raw.clone().text()
    const match = /"model"\s*:\s*"([^"]+)"/.exec(text)
    return match?.[1]
  } catch {
    return undefined
  }
}

// Drains the teed response branch and attaches parsed token usage to the
// record and aggregate counters. Runs in the background so streaming is not
// blocked.
async function scanUsage(
  stream: ReadableStream<Uint8Array>,
  rec: RequestRecord,
): Promise<void> {
  try {
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    let text = ""
    const MAX = 4_000_000
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      text += decoder.decode(value, { stream: true })
      if (text.length > MAX) {
        text = text.slice(-MAX)
      }
    }
    const usage = extractUsage(text)
    if (usage) {
      rec.promptTokens = usage.prompt
      rec.completionTokens = usage.completion
      rec.totalTokens = usage.total
      stats.addTokens(rec, usage)
    }
  } catch {
    // best-effort token accounting; ignore failures
  }
}

// Drops internet scanning noise (any non-API path) before it reaches stats or
// auth: returns 404 without recording, keeping only a lightweight noise count.
// This also protects the directly-exposed app port, not just the nginx edge.
export function allowlistGuard() {
  return async function allowlist(
    c: Context,
    next: Next,
  ): Promise<Response | undefined> {
    if (!isApiPath(c.req.path)) {
      stats.noteDropped()
      return c.json({ error: { message: "Not found", type: "not_found" } }, 404)
    }
    await next()
  }
}

export function statsMiddleware() {
  return async function statsRecorder(c: Context, next: Next): Promise<void> {
    const start = performance.now()
    const ip = getClientIp(c)
    const model = await peekModel(c)

    await next()

    const rec: RequestRecord = {
      time: Date.now(),
      ip,
      method: c.req.method,
      path: c.req.path,
      model,
      status: c.res.status,
      keyId: (c.get("keyId") as string | undefined) || null,
      durationMs: Number((performance.now() - start).toFixed(1)),
    }
    stats.record(rec)

    if (c.res.body && isTokenEndpoint(c.req.path)) {
      try {
        const [clientBranch, scanBranch] = c.res.body.tee()
        c.res = new Response(clientBranch, {
          status: c.res.status,
          headers: c.res.headers,
        })
        void scanUsage(scanBranch, rec)
      } catch {
        // if tee fails, leave the original response untouched
      }
    }
  }
}
