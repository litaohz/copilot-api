import { Hono } from "hono"
import { cors } from "hono/cors"

import { apiKeyAuth } from "~/lib/auth"
import { requestLogger } from "~/lib/logger"
import { state } from "~/lib/state"
import { statsMiddleware, allowlistGuard } from "~/lib/stats-middleware"

import { adminRoute } from "./routes/admin/route"
import { completionRoutes } from "./routes/chat-completions/route"
import { embeddingRoutes } from "./routes/embeddings/route"
import { indexRoute } from "./routes/index/route"
import { messageRoutes } from "./routes/messages/route"
import { modelRoutes } from "./routes/models/route"
import { responseRoutes } from "./routes/responses/route"
import { tokenRoute } from "./routes/token/route"
import { usageRoute } from "./routes/usage/route"

export const server = new Hono()

server.use(requestLogger())
server.use(cors())
// Drop scanner noise (non-API paths) before stats/auth so it never pollutes
// monitoring and leaves 401s as a meaningful "unauthorized" signal.
server.use(allowlistGuard())
// Record stats before auth so unauthorized/probing requests (and their source
// IPs) are also visible for abuse detection.
server.use(statsMiddleware())
server.use(apiKeyAuth())

// Reversible kill switch: when paused, every endpoint except /admin/* returns
// 503 so the service can still be resumed via the admin API.
server.use(async (c, next) => {
  if (state.paused && !c.req.path.startsWith("/admin")) {
    return c.json(
      {
        error: {
          message: "Service is paused by administrator",
          type: "service_paused",
        },
      },
      503,
    )
  }
  await next()
})

server.route("/admin", adminRoute)

server.route("/", indexRoute)

server.route("/chat/completions", completionRoutes)
server.route("/models", modelRoutes)
server.route("/embeddings", embeddingRoutes)
server.route("/responses", responseRoutes)
server.route("/usage", usageRoute)
server.route("/token", tokenRoute)

// Compatibility with tools that expect v1/ prefix
server.route("/v1/chat/completions", completionRoutes)
server.route("/v1/models", modelRoutes)
server.route("/v1/embeddings", embeddingRoutes)
server.route("/v1/responses", responseRoutes)

// Anthropic compatible endpoints
server.route("/v1/messages", messageRoutes)
