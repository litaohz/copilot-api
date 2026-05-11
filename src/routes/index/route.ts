import { Hono } from "hono"

import { state } from "~/lib/state"
import packageJson from "../../../package.json"
import { renderDashboard } from "./page"

export const indexRoute = new Hono()

indexRoute.get("/", (c) => {
  const version = process.env.npm_package_version ?? packageJson.version
  const login = state.githubLogin ?? "unknown"
  const accountType = state.accountType

  const format = c.req.query("format")
  const accept = c.req.header("accept") ?? ""

  if (format === "json" || accept.includes("application/json")) {
    return c.json({ version, login, accountType })
  }

  if (format === "text" || !accept.includes("text/html")) {
    return c.text(
      `Copilot API v${version} - running\nUser: ${login} (${accountType})`,
    )
  }

  const badge = `<span class="text-xs px-2 py-0.5 rounded-full font-mono" style="background: var(--bg-hover); color: var(--fg-muted)">v${version}</span>`
  return c.html(renderDashboard(badge))
})
