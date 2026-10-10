#!/usr/bin/env node

import { defineCommand } from "citty"
import consola from "consola"
import { serve, type ServerHandler } from "srvx"

import { ensurePaths } from "./lib/paths"
import { initProxyFromEnv } from "./lib/proxy"
import { state } from "./lib/state"
import { stats } from "./lib/stats"
import { setupCopilotToken, setupGitHubToken } from "./lib/token"
import { cacheModels, cacheVSCodeVersion } from "./lib/utils"
import { server } from "./server"

interface RunServerOptions {
  port: number
  verbose: boolean
  accountType: string
  manual: boolean
  rateLimit?: number
  rateLimitWait: boolean
  githubToken?: string
  showToken: boolean
  proxyEnv: boolean
  apiKey?: string
}

export async function runServer(options: RunServerOptions): Promise<void> {
  if (options.proxyEnv) {
    initProxyFromEnv()
  }

  if (options.verbose) {
    consola.level = 5
    consola.info("Verbose logging enabled")
  }

  state.accountType = options.accountType
  if (options.accountType !== "individual") {
    consola.info(`Using ${options.accountType} plan GitHub account`)
  }

  state.manualApprove = options.manual
  state.rateLimitSeconds = options.rateLimit
  state.rateLimitWait = options.rateLimitWait
  state.showToken = options.showToken

  state.apiKey = options.apiKey
  if (options.apiKey) {
    consola.info("API key authentication enabled for incoming requests")
  } else {
    consola.warn(
      "No API key set — incoming requests are unauthenticated. Set --api-key or COPILOT_API_KEY before exposing publicly.",
    )
  }

  await ensurePaths()
  await stats.load()
  await cacheVSCodeVersion()

  if (options.githubToken) {
    state.githubToken = options.githubToken
    consola.info("Using provided GitHub token")
  } else {
    await setupGitHubToken()
  }

  await setupCopilotToken()
  await cacheModels()

  consola.info(
    `Available models: \n${state.models?.data.map((model) => `- ${model.id}`).join("\n")}`,
  )

  const serverUrl = `http://localhost:${options.port}`

  consola.box(
    `🌐 Usage Viewer: https://billxc.github.io/copilot-api?endpoint=${serverUrl}/usage`,
  )

  // Persist monitoring stats periodically and on shutdown so they survive
  // restarts (pm2/systemd) and the /admin/shutdown endpoint.
  const saveInterval = setInterval(() => void stats.save(), 30_000)
  if (typeof saveInterval.unref === "function") saveInterval.unref()

  const persistAndExit = (): void => {
    void stats.save().finally(() => process.exit(0))
  }
  process.on("SIGINT", persistAndExit)
  process.on("SIGTERM", persistAndExit)

  serve({
    fetch: server.fetch as ServerHandler,
    port: options.port,
    idleTimeout: 255,
  } as Parameters<typeof serve>[0])
}

export const start = defineCommand({
  meta: {
    name: "start",
    description: "Start the Copilot API server",
  },
  args: {
    port: {
      alias: "p",
      type: "string",
      default: "4141",
      description: "Port to listen on",
    },
    verbose: {
      alias: "v",
      type: "boolean",
      default: false,
      description: "Enable verbose logging",
    },
    "account-type": {
      alias: "a",
      type: "string",
      default: "individual",
      description: "Account type to use (individual, business, enterprise)",
    },
    manual: {
      type: "boolean",
      default: false,
      description: "Enable manual request approval",
    },
    "rate-limit": {
      alias: "r",
      type: "string",
      description: "Rate limit in seconds between requests",
    },
    wait: {
      alias: "w",
      type: "boolean",
      default: false,
      description:
        "Wait instead of error when rate limit is hit. Has no effect if rate limit is not set",
    },
    "github-token": {
      alias: "g",
      type: "string",
      description:
        "Provide GitHub token directly (must be generated using the `auth` subcommand)",
    },
    "show-token": {
      type: "boolean",
      default: false,
      description: "Show GitHub and Copilot tokens on fetch and refresh",
    },
    "proxy-env": {
      type: "boolean",
      default: false,
      description: "Initialize proxy from environment variables",
    },
    "api-key": {
      alias: "k",
      type: "string",
      description:
        "Require this key (Bearer token or x-api-key header) on incoming requests. Defaults to COPILOT_API_KEY env var",
    },
  },
  run({ args }) {
    const rateLimitRaw = args["rate-limit"]
    const rateLimit =
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      rateLimitRaw === undefined ? undefined : Number.parseInt(rateLimitRaw, 10)

    return runServer({
      port: Number.parseInt(args.port, 10),
      verbose: args.verbose,
      accountType: args["account-type"],
      manual: args.manual,
      rateLimit,
      rateLimitWait: args.wait,
      githubToken: args["github-token"],
      showToken: args["show-token"],
      proxyEnv: args["proxy-env"],
      apiKey:
        (args["api-key"] as string | undefined) ?? process.env.COPILOT_API_KEY,
    })
  },
})
