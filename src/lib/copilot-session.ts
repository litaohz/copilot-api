import type { GetCopilotTokenResponse } from "~/services/github/get-copilot-token"

import { state } from "./state"

function validateEndpoint(endpoint: string): string {
  const url = new URL(endpoint)
  const host = state.githubHost ?? "github.com"
  const trustedHost =
    url.hostname === "api.githubcopilot.com"
    || url.hostname.endsWith(".githubcopilot.com")
    || (host !== "github.com" && url.hostname.endsWith(`.${host}`))
  if (
    url.protocol !== "https:"
    || url.username
    || url.password
    || url.port
    || url.pathname !== "/"
    || url.search
    || url.hash
    || !trustedHost
  ) {
    throw new Error("GitHub returned an invalid Copilot API endpoint")
  }
  return url.origin
}

export function applyCopilotToken(session: GetCopilotTokenResponse): void {
  const api =
    session.endpoints?.api ? validateEndpoint(session.endpoints.api) : undefined
  if (!api && state.githubHost && state.githubHost !== "github.com") {
    throw new Error("Enterprise Copilot token did not provide an API endpoint")
  }
  if (!session.token) throw new Error("GitHub returned an empty Copilot token")
  state.copilotApiBaseUrl = api
  state.copilotToken = session.token
}
