import {
  GITHUB_CLIENT_ID,
  githubBaseUrl,
  standardHeaders,
} from "~/lib/api-config"
import { HTTPError } from "~/lib/error"
import { state } from "~/lib/state"
import { sleep } from "~/lib/utils"

import type { DeviceCodeResponse } from "./get-device-code"

interface PollClock {
  now: () => number
  wait: (ms: number) => Promise<unknown>
}

export async function pollAccessToken(
  deviceCode: DeviceCodeResponse,
  clock: PollClock = { now: Date.now, wait: sleep },
): Promise<string> {
  const expiresAt = clock.now() + deviceCode.expires_in * 1000
  let interval = (deviceCode.interval + 1) * 1000
  while (clock.now() + interval < expiresAt) {
    await clock.wait(interval)
    const remaining = expiresAt - clock.now()
    if (remaining <= 0) break
    const response = await fetch(
      `${githubBaseUrl(state)}/login/oauth/access_token`,
      {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(Math.min(remaining, 30_000)),
        headers: standardHeaders(),
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          device_code: deviceCode.device_code,
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        }),
      },
    )
    if (!response.ok) {
      throw new HTTPError("Failed to poll GitHub authorization", response)
    }
    const result = (await response.json()) as AccessTokenResponse
    if (result.access_token) return result.access_token
    switch (result.error) {
      case "authorization_pending": {
        break
      }
      case "slow_down": {
        interval += 5000
        break
      }
      case "access_denied": {
        throw new Error(
          "GitHub authorization was denied; run auth to try again",
        )
      }
      case "expired_token": {
        throw new Error("GitHub device code expired; run auth for a new code")
      }
      default: {
        throw new Error("GitHub device authorization failed; run auth again")
      }
    }
  }
  throw new Error("GitHub device code expired; run auth for a new code")
}

interface AccessTokenResponse {
  access_token?: string
  error?: string
}
