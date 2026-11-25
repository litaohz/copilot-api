import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"

type JsonRecord = Record<string, unknown>

function record(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function geminiModel(id: string, name: string, priority: number): JsonRecord {
  return {
    slug: id,
    display_name: name,
    description:
      "Gemini via Copilot Responses bridge; function and text tools.",
    supported_reasoning_levels: ["low", "medium", "high"].map((effort) => ({
      effort,
      description: `${effort} reasoning`,
    })),
    default_reasoning_level: "low",
    shell_type: "unified_exec",
    visibility: "list",
    supported_in_api: true,
    priority,
    support_verbosity: false,
    truncation_policy: { mode: "tokens", limit: 10000 },
    experimental_supported_tools: [],
    input_modalities: ["text", "image"],
    supports_parallel_tool_calls: true,
    supports_search_tool: false,
    supports_reasoning_summaries: false,
    supports_reasoning_summary_parameter: false,
    tool_mode: "direct",
    apply_patch_tool_type: null,
    include_skills_usage_instructions: false,
    include_apps_usage_instructions: false,
    include_plugin_usage_instructions: false,
    // Conservative client budgeting, not a claim about upstream maximums.
    context_window: 32768,
    max_context_window: 32768,
    effective_context_window_percent: 95,
    model_messages: {
      instructions_template:
        "You are a coding agent. Complete the user task accurately. Use the available function tools to inspect and change files when needed. Respect the workspace instructions and do not claim a tool succeeded unless its result confirms success. Keep responses concise.",
    },
  }
}

async function loadCatalog(path: string): Promise<Array<JsonRecord>> {
  let text: string
  try {
    text = await readFile(path, "utf8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return []
    throw error
  }
  const parsed: unknown = JSON.parse(text)
  if (
    !record(parsed)
    || !Array.isArray(parsed.models)
    || !parsed.models.every(
      (model: unknown) => record(model) && typeof model.slug === "string",
    )
  ) {
    throw new Error(
      "Existing catalog must contain a models array with model slugs",
    )
  }
  return parsed.models as Array<JsonRecord>
}

async function main(): Promise<void> {
  const [path, base = "http://127.0.0.1:4141/v1"] = process.argv.slice(2)
  if (!path)
    throw new Error(
      "Usage: bun run scripts/generate-gemini-catalog.ts <catalog.json> [base-url]",
    )
  const key = process.env.COPILOT_API_KEY ?? process.env.OPENAI_API_KEY
  if (!key)
    throw new Error("Set COPILOT_API_KEY or OPENAI_API_KEY for the proxy")
  const url = new URL(`${base.replace(/\/$/u, "")}/models`)
  if (!url.protocol.startsWith("http") || url.username || url.password)
    throw new Error("Invalid proxy URL")
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${key}` },
    redirect: "error",
    signal: AbortSignal.timeout(30000),
  })
  if (!response.ok)
    throw new Error(`Models endpoint returned HTTP ${response.status}`)
  const payload: unknown = await response.json()
  if (!record(payload) || !Array.isArray(payload.data))
    throw new Error("Invalid models endpoint response")
  const available = payload.data.filter(
    (model: unknown): model is JsonRecord =>
      record(model)
      && typeof model.id === "string"
      && model.id.startsWith("gemini-"),
  )
  if (available.length === 0) throw new Error("The proxy has no Gemini models")
  const destination = resolve(path)
  const existing = await loadCatalog(destination)
  const models = existing.filter(
    (model) => !String(model.slug).startsWith("gemini-"),
  )
  const gemini = available.map((model, index) =>
    geminiModel(
      String(model.id),
      typeof model.display_name === "string" ?
        model.display_name
      : String(model.id),
      100 + index,
    ),
  )
  await mkdir(dirname(destination), { recursive: true })
  if (existing.length > 0) {
    const backup = `${destination}.${Date.now()}.bak`
    await copyFile(destination, backup)
    console.log(`Catalog backup: ${backup}`)
  }
  await writeFile(
    destination,
    JSON.stringify({ models: [...models, ...gemini] }, null, 2) + "\n",
  )
  console.log(
    `Updated ${destination}: ${gemini.map((model) => model.slug).join(", ")}`,
  )
  console.log(
    "Set model_catalog_json to this file and restart Codex to reload the picker.",
  )
}

await main()
