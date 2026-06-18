import consola from "consola"
import { Hono } from "hono"

import { forwardError } from "~/lib/error"
import { state } from "~/lib/state"
import { cacheModels } from "~/lib/utils"

export const modelRoutes = new Hono()

modelRoutes.get("/", async (c) => {
  try {
    // Always refresh from upstream so the dashboard and clients see the
    // current model list rather than the snapshot taken at server startup.
    // Fall back to the cached copy if the refresh fails for any reason.
    try {
      await cacheModels()
    } catch (error) {
      if (!state.models) throw error
      consola.warn("Failed to refresh models, serving cached copy", error)
    }

    const models = state.models?.data.map((model) => ({
      id: model.id,
      object: "model",
      type: "model",
      created: 0, // No date available from source
      created_at: new Date(0).toISOString(), // No date available from source
      owned_by: model.vendor,
      display_name: model.name,
    }))

    return c.json({
      object: "list",
      data: models,
      has_more: false,
    })
  } catch (error) {
    return await forwardError(c, error)
  }
})
