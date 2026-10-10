import consola from "consola"
import { Hono } from "hono"

import { state } from "~/lib/state"
import { stats } from "~/lib/stats"

export const adminRoute = new Hono()
// Usage / monitoring snapshot: models, tokens, request counts, source IPs,
// status codes and recent requests. Protected by the global API key middleware.
adminRoute.get("/stats", (c) => {
  return c.json(stats.snapshot(state.paused))
})

// Reversible kill switch: pause all proxy endpoints (they return 503) while
// keeping the admin endpoints reachable so it can be resumed.
adminRoute.post("/pause", (c) => {
  state.paused = true
  consola.warn("Service PAUSED via /admin/pause — proxy endpoints return 503")
  return c.json({ paused: true })
})

adminRoute.post("/resume", (c) => {
  state.paused = false
  consola.info("Service RESUMED via /admin/resume")
  return c.json({ paused: false })
})

// Hard stop: exits the process. Under a process manager (pm2/systemd) the
// service will be restarted; use the manager's stop command for a permanent
// stop. Useful as an immediate hard kill.
adminRoute.post("/shutdown", (c) => {
  consola.warn("Shutdown requested via /admin/shutdown — exiting process")
  setTimeout(() => {
    void stats.save().finally(() => process.exit(0))
  }, 100)
  return c.json({ shuttingDown: true })
})
