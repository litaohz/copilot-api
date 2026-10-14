import { state } from "./state"

export function normalizeGitHubHost(value = "github.com"): string {
  const input = value.trim().toLowerCase()
  const url = new URL(input.includes("://") ? input : `https://${input}`)
  if (
    url.protocol !== "https:"
    || url.username
    || url.password
    || url.port
    || url.pathname !== "/"
    || url.search
    || url.hash
    || !/^(?:github\.com|[a-z\d](?:[a-z\d-]*[a-z\d])?\.ghe\.com)$/.test(
      url.hostname,
    )
  ) {
    throw new Error("GitHub host must be github.com or <enterprise>.ghe.com")
  }
  return url.hostname
}

export interface GitHubOptions {
  githubHost?: string
  dataDir?: string
}

export const githubArgs = {
  "github-host": {
    type: "string",
    description:
      "GitHub host (github.com or <enterprise>.ghe.com); defaults to COPILOT_GITHUB_HOST",
  },
  "data-dir": {
    type: "string",
    description:
      "Private token and statistics directory; defaults to COPILOT_DATA_DIR or a host-specific directory",
  },
} as const

export function configureGitHub(options: GitHubOptions = {}): void {
  state.githubHost = normalizeGitHubHost(
    options.githubHost ?? process.env.COPILOT_GITHUB_HOST,
  )
  state.dataDir = options.dataDir ?? process.env.COPILOT_DATA_DIR
  state.copilotApiBaseUrl = undefined
}
