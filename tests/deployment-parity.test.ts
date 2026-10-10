import { expect, test } from "bun:test"
import { timingSafeEqual } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"
import vm from "node:vm"

import type { RequestRecord, UsageTokens } from "~/lib/stats"

const root = new URL("../", import.meta.url)
const bundle = readFileSync(
  new URL("tests/fixtures/production-before-error-fix.txt", root),
  "utf8",
)
const transpiler = new Bun.Transpiler({ loader: "ts" })

function source(name: string): string {
  return transpiler
    .transformSync(
      readFileSync(new URL(name, root), "utf8").replaceAll(
        /^import\b[\s\S]+?from\s+["'][^"']+["']\s*$/gm,
        "",
      ),
    )
    .replaceAll(/\bexport\s+/g, "")
}

function between(start: string, end: string): string {
  const first = bundle.indexOf(start)
  const last = bundle.indexOf(end, first + start.length)
  if (first < 0 || last === -1)
    throw new Error("Unexpected production bundle layout")
  return bundle.slice(first, last)
}

interface StatsProbe {
  record(rec: RequestRecord): void
  addTokens(rec: RequestRecord, usage: UsageTokens): void
  snapshot(paused: boolean): unknown
  save(): Promise<void>
  load(): Promise<void>
  byIp: Map<string, { keys: unknown }>
}

class FixedDate extends Date {
  static override now(): number {
    return 1_790_000_000_000
  }
}

function statsProbe(live: boolean, initial = "") {
  let stored = initial
  const fs = {
    readFile: () => Promise.resolve(stored),
    writeFile: (_file: string, text: string) => {
      stored = text
      return Promise.resolve()
    },
    rename: () => Promise.resolve(),
  }
  const context = vm.createContext({
    Date: FixedDate,
    Map,
    Set,
    fs,
    path,
    PATHS: { APP_DIR: "synthetic-memory" },
    r: fs,
    R: "synthetic-memory/stats.json",
  })
  const script =
    live ?
      between("const z=new class", ";function lt") + ";z"
    : source("src/lib/stats.ts") + ";stats"
  const stats = vm.runInContext(script, context) as StatsProbe
  return { stats, stored: () => stored }
}

test("restored multi-key matching agrees with the deployed bundle", () => {
  const env = { COPILOT_API_KEY_NAMES: "primary,,retired" }
  const context = vm.createContext({
    Buffer,
    process: { env },
    timingSafeEqual,
    f: timingSafeEqual,
  })
  const live = vm.runInContext(
    between("function dt(", "function ft(") + ";dt",
    context,
  ) as (a: string, b: string) => string | false
  const restored = vm.runInContext(
    source("src/lib/auth.ts") + ";matchKey",
    context,
  ) as (a: string, b: string) => string | false
  for (const configured of [
    "alpha,beta,gamma",
    " alpha, ,beta, gamma ",
    "",
    "alpha",
  ])
    for (const supplied of ["alpha", "beta", "gamma", "wrong", ""])
      expect(restored(supplied, configured)).toEqual(live(supplied, configured))
})

test("restored per-key accounting, persistence and legacy repair match production", async () => {
  const live = statsProbe(true)
  const restored = statsProbe(false)
  const requests: Array<RequestRecord> = [
    {
      time: 100,
      ip: "one",
      method: "POST",
      path: "/v1/responses",
      model: "gpt-6-astra",
      status: 200,
      durationMs: 5,
      keyId: "primary",
    },
    {
      time: 200,
      ip: "one",
      method: "POST",
      path: "/v1/responses",
      model: "gpt-6-astra",
      status: 200,
      durationMs: 8,
      keyId: "retired",
    },
    {
      time: 300,
      ip: "two",
      method: "GET",
      path: "/v1/models",
      status: 401,
      durationMs: 1,
    },
    {
      time: 400,
      ip: "three",
      method: "GET",
      path: "/v1/models",
      status: 200,
      durationMs: 2,
    },
  ]
  for (const probe of [live, restored]) {
    for (const rec of requests) probe.stats.record(rec)
    probe.stats.addTokens(requests[0], { prompt: 11, completion: 7, total: 18 })
    const old = probe.stats.byIp.get("one")
    if (!old) throw new Error("Missing synthetic IP")
    old.keys = {}
    probe.stats.record({ ...requests[0], time: 500, keyId: "recovered" })
    await probe.stats.save()
  }
  expect(JSON.stringify(restored.stats.snapshot(false))).toBe(
    JSON.stringify(live.stats.snapshot(false)),
  )
  expect(restored.stored()).toBe(live.stored())
  const reloadedLive = statsProbe(true, live.stored())
  const reloadedRestored = statsProbe(false, restored.stored())
  await reloadedLive.stats.load()
  await reloadedRestored.stats.load()
  expect(JSON.stringify(reloadedRestored.stats.snapshot(false))).toBe(
    JSON.stringify(reloadedLive.stats.snapshot(false)),
  )
})

test("the source adapter is byte-identical to the deployed adapter", () => {
  for (const name of ["stable-ids.mjs", "responses-compat.mjs"])
    expect(readFileSync(new URL(`src/lib/responses/${name}`, root))).toEqual(
      readFileSync(new URL(`dist/${name}`, root)),
    )
})
