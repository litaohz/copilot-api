import { afterAll, afterEach, expect, spyOn, test } from "bun:test"
import { rejects } from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import {
  copilotBaseUrl,
  githubApiBaseUrl,
  githubBaseUrl,
} from "~/lib/api-config"
import { applyCopilotToken } from "~/lib/copilot-session"
import { configureGitHub, normalizeGitHubHost } from "~/lib/github-host"
import { ensurePaths, PATHS } from "~/lib/paths"
import { state } from "~/lib/state"
import { getCopilotToken } from "~/services/github/get-copilot-token"
import { getCopilotUsage } from "~/services/github/get-copilot-usage"
import {
  getDeviceCode,
  type DeviceCodeResponse,
} from "~/services/github/get-device-code"
import { getGitHubUser } from "~/services/github/get-user"
import { pollAccessToken } from "~/services/github/poll-access-token"

const original = { ...state }
const preconnect = globalThis.fetch.preconnect
const fetchSpy = spyOn(globalThis, "fetch")
afterAll(() => fetchSpy.mockRestore())

afterEach(() => {
  Object.assign(state, {
    githubHost: undefined,
    dataDir: undefined,
    copilotApiBaseUrl: undefined,
    ...original,
  })
  fetchSpy.mockReset()
})

const code: DeviceCodeResponse = {
  device_code: "synthetic-device",
  user_code: "TEST-CODE",
  verification_uri: "https://msft.ghe.com/login/device",
  expires_in: 900,
  interval: 5,
}

function virtualClock() {
  let time = 0
  const waits: Array<number> = []
  return {
    now: () => time,
    wait: (ms: number) => {
      waits.push(ms)
      time += ms
      return Promise.resolve()
    },
    waits,
  }
}

test("accepts cloud hosts and rejects URLs that could misroute credentials", () => {
  expect(normalizeGitHubHost()).toBe("github.com")
  expect(normalizeGitHubHost("https://MSFT.ghe.com/")).toBe("msft.ghe.com")
  for (const host of [
    "",
    "http://msft.ghe.com",
    "msft.ghe.com.evil.test",
    "api.msft.ghe.com",
    "https://user@msft.ghe.com",
    "msft.ghe.com/path",
    "msft.ghe.com?x=1",
    "localhost:4141",
  ])
    expect(() => normalizeGitHubHost(host)).toThrow()
})

test("isolates default host storage and allows a separate instance directory", async () => {
  configureGitHub({ githubHost: "github.com" })
  const defaultPath = PATHS.GITHUB_TOKEN_PATH
  configureGitHub({ githubHost: "msft.ghe.com" })
  expect(PATHS.GITHUB_TOKEN_PATH).not.toBe(defaultPath)
  expect(PATHS.GITHUB_TOKEN_PATH).toContain("msft.ghe.com")
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "copilot-host-test-"),
  )
  try {
    configureGitHub({ githubHost: "msft.ghe.com", dataDir: directory })
    await ensurePaths()
    expect(PATHS.APP_DIR).toBe(directory)
    await fs.writeFile(PATHS.GITHUB_TOKEN_PATH, "synthetic")
    await ensurePaths()
    expect(await fs.readFile(PATHS.GITHUB_TOKEN_PATH, "utf8")).toBe("synthetic")
  } finally {
    await fs.unlink(path.join(directory, "github_token"))
    await fs.rmdir(directory)
  }
})

test("all GitHub service calls use the selected enterprise and disable redirects", async () => {
  configureGitHub({ githubHost: "msft.ghe.com" })
  state.githubToken = "synthetic-github"
  fetchSpy.mockImplementation(
    Object.assign(() => Promise.resolve(Response.json(code)), { preconnect }),
  )
  expect(githubBaseUrl(state)).toBe("https://msft.ghe.com")
  expect(githubApiBaseUrl(state)).toBe("https://api.msft.ghe.com")
  await getDeviceCode()
  await getGitHubUser()
  await getCopilotToken()
  await getCopilotUsage()
  expect(fetchSpy.mock.calls.map(([url]) => url)).toEqual([
    "https://msft.ghe.com/login/device/code",
    "https://api.msft.ghe.com/user",
    "https://api.msft.ghe.com/copilot_internal/v2/token",
    "https://api.msft.ghe.com/copilot_internal/user",
  ])
  for (const [, options] of fetchSpy.mock.calls)
    expect(options?.redirect).toBe("error")
})

test("rejects a device response with another verification host", async () => {
  configureGitHub({ githubHost: "msft.ghe.com" })
  fetchSpy.mockResolvedValue(
    Response.json({
      ...code,
      verification_uri: "https://github.com/login/device",
    }),
  )
  await rejects(getDeviceCode(), /different host/)
})

test("pending authorization and slow_down obey polling intervals before success", async () => {
  configureGitHub({ githubHost: "msft.ghe.com" })
  const clock = virtualClock()
  fetchSpy
    .mockResolvedValueOnce(Response.json({ error: "authorization_pending" }))
    .mockResolvedValueOnce(Response.json({ error: "slow_down" }))
    .mockResolvedValueOnce(Response.json({ access_token: "synthetic-access" }))
  expect(await pollAccessToken(code, clock)).toBe("synthetic-access")
  expect(clock.waits).toEqual([6000, 6000, 11000])
  expect(fetchSpy.mock.calls[0]?.[0]).toBe(
    "https://msft.ghe.com/login/oauth/access_token",
  )
})

test("denial, expiry and unexpected OAuth errors terminate without retrying", async () => {
  for (const error of [
    "access_denied",
    "expired_token",
    "incorrect_client_credentials",
  ]) {
    fetchSpy.mockReset()
    fetchSpy.mockResolvedValue(Response.json({ error }))
    await rejects(pollAccessToken(code, virtualClock()))
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  }
})

test("device polling expires locally even when the provider keeps returning pending", async () => {
  fetchSpy.mockImplementation(
    Object.assign(
      () => Promise.resolve(Response.json({ error: "authorization_pending" })),
      { preconnect },
    ),
  )
  await rejects(
    pollAccessToken({ ...code, expires_in: 20 }, virtualClock()),
    /expired/,
  )
  expect(fetchSpy).toHaveBeenCalledTimes(3)
})

test("enterprise sessions require the returned API endpoint and refresh it with the token", () => {
  configureGitHub({ githubHost: "msft.ghe.com" })
  const session = { token: "synthetic-1", refresh_in: 1800, expires_at: 1900 }
  expect(() => applyCopilotToken(session)).toThrow("API endpoint")
  expect(() => copilotBaseUrl(state)).toThrow("API endpoint")
  applyCopilotToken({
    ...session,
    endpoints: { api: "https://copilot-api.msft.ghe.com/" },
  })
  expect(copilotBaseUrl(state)).toBe("https://copilot-api.msft.ghe.com")
  applyCopilotToken({
    ...session,
    token: "synthetic-2",
    endpoints: { api: "https://api.enterprise.githubcopilot.com" },
  })
  expect(copilotBaseUrl(state)).toBe("https://api.enterprise.githubcopilot.com")
  expect(state.copilotToken).toBe("synthetic-2")
  for (const api of [
    "http://copilot-api.msft.ghe.com",
    "https://evil.test",
    "https://copilot-api.other.ghe.com",
    "https://api.githubcopilot.com@evil.test",
    "https://api.githubcopilot.com/?token=secret",
  ]) {
    expect(() =>
      applyCopilotToken({ ...session, endpoints: { api } }),
    ).toThrow()
    expect(state.copilotToken).toBe("synthetic-2")
  }
})

test("ordinary GitHub accounts preserve account-type fallback when no endpoint is returned", () => {
  configureGitHub({ githubHost: "github.com" })
  applyCopilotToken({ token: "synthetic", refresh_in: 1800, expires_at: 1900 })
  state.accountType = "individual"
  expect(copilotBaseUrl(state)).toBe("https://api.githubcopilot.com")
  state.accountType = "enterprise"
  expect(copilotBaseUrl(state)).toBe("https://api.enterprise.githubcopilot.com")
})
