import type { Context } from "hono"

import fs from "node:fs/promises"
import path from "node:path"

import { PATHS } from "./paths"

export interface UsageTokens {
  prompt: number
  completion: number
  total: number
}

export interface RequestRecord {
  time: number
  ip: string
  method: string
  path: string
  model?: string
  status: number
  keyId?: string | null
  durationMs: number
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
}

interface ModelStat {
  count: number
  prompt: number
  completion: number
  total: number
}

interface IpStat {
  count: number
  authorized: number
  unauthorized: number
  tokens: number
  lastSeen: number
  models: Set<string>
  keys: Set<string>
}

interface KeyStat {
  count: number
  tokens: number
  lastSeen: number
  ips: Set<string>
  models: Set<string>
}

// Preserve the deployed patch's handling of legacy arrays and lost `{}` sets.
function restoredKeys(value: unknown): Set<string> {
  if (value instanceof Set) return value as Set<string>
  return new Set(Array.isArray(value) ? (value as Array<string>) : [])
}

const RECENT_LIMIT = 200
const statsPath = () => path.join(PATHS.APP_DIR, "stats.json")

// Known API path prefixes. Anything else is internet scanning noise and is
// dropped (404) before it reaches stats or auth.
const EXACT_API_PATHS = new Set([
  "/",
  "/chat/completions",
  "/models",
  "/embeddings",
  "/responses",
  "/usage",
  "/token",
])

export function isApiPath(p: string): boolean {
  if (EXACT_API_PATHS.has(p)) return true
  return p.startsWith("/v1/") || p.startsWith("/admin/")
}

class Stats {
  startedAt = Date.now()
  totalRequests = 0
  droppedNoise = 0
  tokens: UsageTokens = { prompt: 0, completion: 0, total: 0 }
  byModel = new Map<string, ModelStat>()
  byIp = new Map<string, IpStat>()
  byStatus = new Map<number, number>()
  byKey = new Map<string, KeyStat>()
  recent: Array<RequestRecord> = []

  noteDropped(): void {
    this.droppedNoise += 1
  }

  record(rec: RequestRecord): void {
    this.totalRequests += 1

    this.byStatus.set(rec.status, (this.byStatus.get(rec.status) ?? 0) + 1)

    const key = rec.keyId || (rec.status === 401 ? "__unauth__" : "__unknown__")
    const keyStat = this.byKey.get(key) ?? {
      count: 0,
      tokens: 0,
      lastSeen: 0,
      ips: new Set<string>(),
      models: new Set<string>(),
    }
    keyStat.count += 1
    keyStat.lastSeen = rec.time
    if (rec.ip) keyStat.ips.add(rec.ip)
    if (rec.model) keyStat.models.add(rec.model)
    this.byKey.set(key, keyStat)

    const ipStat = this.byIp.get(rec.ip) ?? {
      count: 0,
      authorized: 0,
      unauthorized: 0,
      tokens: 0,
      lastSeen: 0,
      models: new Set<string>(),
      keys: new Set<string>(),
    }
    ipStat.count += 1
    ipStat.lastSeen = rec.time
    if (rec.status === 401) {
      ipStat.unauthorized += 1
    } else if (rec.status < 400) {
      ipStat.authorized += 1
    }
    if (rec.model) ipStat.models.add(rec.model)
    ipStat.keys = restoredKeys(ipStat.keys)
    if (rec.keyId) ipStat.keys.add(rec.keyId)
    this.byIp.set(rec.ip, ipStat)

    if (rec.model) {
      const modelStat = this.byModel.get(rec.model) ?? {
        count: 0,
        prompt: 0,
        completion: 0,
        total: 0,
      }
      modelStat.count += 1
      this.byModel.set(rec.model, modelStat)
    }

    this.recent.push(rec)
    if (this.recent.length > RECENT_LIMIT) {
      this.recent.splice(0, this.recent.length - RECENT_LIMIT)
    }
  }

  // Called asynchronously once token usage is parsed from the response body.
  addTokens(rec: RequestRecord, usage: UsageTokens): void {
    this.tokens.prompt += usage.prompt
    this.tokens.completion += usage.completion
    this.tokens.total += usage.total

    if (rec.keyId) {
      const keyStat = this.byKey.get(rec.keyId)
      if (keyStat) keyStat.tokens += usage.total
    }

    const ipStat = this.byIp.get(rec.ip)
    if (ipStat) ipStat.tokens += usage.total

    if (rec.model) {
      const modelStat = this.byModel.get(rec.model) ?? {
        count: 0,
        prompt: 0,
        completion: 0,
        total: 0,
      }
      modelStat.prompt += usage.prompt
      modelStat.completion += usage.completion
      modelStat.total += usage.total
      this.byModel.set(rec.model, modelStat)
    }
  }

  snapshot(paused: boolean) {
    const now = Date.now()
    return {
      startedAt: new Date(this.startedAt).toISOString(),
      uptimeSeconds: Math.floor((now - this.startedAt) / 1000),
      paused,
      totalRequests: this.totalRequests,
      droppedNoise: this.droppedNoise,
      tokens: this.tokens,
      models: [...this.byModel.entries()]
        .map(([model, s]) => ({ model, ...s }))
        .sort((a, b) => b.count - a.count),
      ips: [...this.byIp.entries()]
        .map(([ip, s]) => ({
          ip,
          count: s.count,
          authorized: s.authorized,
          unauthorized: s.unauthorized,
          tokens: s.tokens,
          lastSeen: new Date(s.lastSeen).toISOString(),
          models: [...s.models],
          keys: [...restoredKeys(s.keys)],
        }))
        .sort((a, b) => b.count - a.count),
      keys: [...this.byKey.entries()]
        .map(([key, s]) => ({
          key,
          count: s.count,
          tokens: s.tokens,
          lastSeen: new Date(s.lastSeen).toISOString(),
          ips: [...s.ips],
          ipCount: s.ips.size,
          models: [...s.models],
        }))
        .sort((a, b) => b.count - a.count),
      statuses: Object.fromEntries(
        [...this.byStatus.entries()].sort((a, b) => a[0] - b[0]),
      ),
      recent: [...this.recent].reverse(),
    }
  }

  private serialize(): string {
    return JSON.stringify({
      startedAt: this.startedAt,
      totalRequests: this.totalRequests,
      droppedNoise: this.droppedNoise,
      tokens: this.tokens,
      byModel: [...this.byModel.entries()],
      byIp: [...this.byIp.entries()].map(([ip, s]) => [
        ip,
        { ...s, models: [...s.models], keys: [...restoredKeys(s.keys)] },
      ]),
      byStatus: [...this.byStatus.entries()],
      recent: this.recent,
    })
  }

  async save(): Promise<void> {
    try {
      const tmp = `${statsPath()}.tmp`
      await fs.writeFile(tmp, this.serialize())
      await fs.rename(tmp, statsPath())
    } catch {
      // best-effort persistence; never crash on write failure
    }
  }

  async load(): Promise<void> {
    try {
      // eslint-disable-next-line unicorn/prefer-json-parse-buffer -- JSON.parse requires a string in TypeScript.
      const raw = await fs.readFile(statsPath(), "utf8")
      const d = JSON.parse(raw) as {
        startedAt?: number
        totalRequests?: number
        droppedNoise?: number
        tokens?: UsageTokens
        byModel?: Array<[string, ModelStat]>
        byIp?: Array<
          [
            string,
            Omit<IpStat, "models" | "keys"> & {
              models: Array<string>
              keys?: unknown
            },
          ]
        >
        byStatus?: Array<[number, number]>
        recent?: Array<RequestRecord>
      }
      this.startedAt = d.startedAt ?? this.startedAt
      this.totalRequests = d.totalRequests ?? 0
      this.droppedNoise = d.droppedNoise ?? 0
      this.tokens = d.tokens ?? { prompt: 0, completion: 0, total: 0 }
      this.byModel = new Map(d.byModel ?? [])
      this.byIp = new Map(
        (d.byIp ?? []).map(([ip, s]) => [
          ip,
          { ...s, models: new Set(s.models), keys: restoredKeys(s.keys) },
        ]),
      )
      this.byStatus = new Map(d.byStatus ?? [])
      this.recent = d.recent ?? []
    } catch {
      // no persisted stats yet (first run) — start fresh
    }
  }
}

export const stats = new Stats()

export function getClientIp(c: Context): string {
  // X-Real-IP is set by our nginx to the real TCP peer and overrides any
  // client-supplied value, so it is the trustworthy source behind the proxy.
  const realIp = c.req.header("x-real-ip")
  if (realIp) return realIp.trim()

  const xff = c.req.header("x-forwarded-for")
  if (xff) {
    const first = xff.split(",")[0]?.trim()
    if (first) return first
  }

  const ip = (c.req.raw as Request & { ip?: string }).ip
  return ip ?? "unknown"
}

// Tolerant usage extractor: works across OpenAI (prompt_tokens/completion_tokens)
// and Anthropic (input_tokens/output_tokens) shapes, in both JSON and SSE bodies.
export function extractUsage(text: string): UsageTokens | undefined {
  const lastMatch = (re: RegExp): number | undefined => {
    let value: number | undefined
    for (const m of text.matchAll(re)) {
      value = Number.parseInt(m[1], 10)
    }
    return value
  }

  const prompt = lastMatch(/"(?:prompt_tokens|input_tokens)"\s*:\s*(\d+)/g)
  const completion = lastMatch(
    /"(?:completion_tokens|output_tokens)"\s*:\s*(\d+)/g,
  )
  let total = lastMatch(/"total_tokens"\s*:\s*(\d+)/g)

  if (prompt === undefined && completion === undefined && total === undefined) {
    return undefined
  }

  if (total === undefined) {
    total = (prompt ?? 0) + (completion ?? 0)
  }

  return {
    prompt: prompt ?? 0,
    completion: completion ?? 0,
    total,
  }
}
