import {
  GITHUB_APP_SCOPES,
  githubBaseUrl,
  GITHUB_CLIENT_ID,
  standardHeaders,
} from "~/lib/api-config"
import { HTTPError } from "~/lib/error"
import { state } from "~/lib/state"

export async function getDeviceCode(): Promise<DeviceCodeResponse> {
  const response = await fetch(`${githubBaseUrl(state)}/login/device/code`, {
    method: "POST",
    redirect: "error",
    headers: standardHeaders(),
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      scope: GITHUB_APP_SCOPES,
    }),
  })

  if (!response.ok) throw new HTTPError("Failed to get device code", response)

  const code = (await response.json()) as DeviceCodeResponse
  if (
    !code.device_code
    || !code.user_code
    || !Number.isFinite(code.expires_in)
    || code.expires_in <= 0
    || !Number.isFinite(code.interval)
    || code.interval < 0
  ) {
    throw new Error("GitHub returned an invalid device authorization response")
  }
  const verification = new URL(code.verification_uri)
  if (
    verification.origin !== githubBaseUrl(state)
    || verification.username
    || verification.password
  ) {
    throw new Error("GitHub returned a verification URL for a different host")
  }
  return code
}

export interface DeviceCodeResponse {
  device_code: string
  user_code: string
  verification_uri: string
  expires_in: number
  interval: number
}
