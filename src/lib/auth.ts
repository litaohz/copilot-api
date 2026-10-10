import type { Context, Next } from "hono"

import { timingSafeEqual } from "node:crypto"

import { state } from "./state"

function matchKey(a: string, b: string): string | false {
  const bufA = Buffer.from(a)
  const keys = b
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean)
  const names = (process.env.COPILOT_API_KEY_NAMES ?? "")
    .split(",")
    .map((name) => name.trim())
  for (const [index, key] of keys.entries()) {
    const bufB = Buffer.from(key)
    if (bufA.length === bufB.length && timingSafeEqual(bufA, bufB)) {
      return names[index] || `key${index + 1}`
    }
  }
  return false
}

function extractKey(c: Context): string | undefined {
  const authHeader = c.req.header("authorization")
  if (authHeader) {
    // eslint-disable-next-line regexp/no-super-linear-backtracking -- Preserve the deployed parser during this version synchronization.
    const match = /^Bearer\s+(.+)$/i.exec(authHeader)
    if (match) {
      return match[1].trim()
    }
  }

  // Anthropic-style header used by Claude clients
  const apiKeyHeader = c.req.header("x-api-key")
  if (apiKeyHeader) {
    return apiKeyHeader.trim()
  }

  return undefined
}

// Hono middleware that enforces a Bearer / x-api-key token on every request
// when `state.apiKey` is set. When no key is configured it is a no-op, keeping
// local usage unauthenticated and backwards compatible.
export function apiKeyAuth() {
  return async function apiKeyAuthMiddleware(
    c: Context,
    next: Next,
  ): Promise<Response | undefined> {
    const { apiKey } = state

    if (!apiKey) {
      await next()
      return
    }

    // Let CORS preflight requests through untouched
    if (c.req.method === "OPTIONS") {
      await next()
      return
    }

    const provided = extractKey(c)
    const keyId = provided ? matchKey(provided, apiKey) : false

    if (!provided || !keyId) {
      return c.json(
        {
          error: {
            message: "Unauthorized: invalid or missing API key",
            type: "authentication_error",
          },
        },
        401,
      )
    }

    c.set("keyId", keyId)
    await next()
  }
}
