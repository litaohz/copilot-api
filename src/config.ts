#!/usr/bin/env node

import { readFile, mkdir, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"

import { defineCommand } from "citty"
import consola from "consola"
async function configureClaude(): Promise<void> {
  const configDir = join(homedir(), ".claude")
  const configPath = join(configDir, "settings.json")

  await mkdir(configDir, { recursive: true })

  let existing: Record<string, unknown> = {}
  try {
    const raw = await readFile(configPath, "utf-8")
    existing = JSON.parse(raw) as Record<string, unknown>
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      consola.error(`Failed to parse ${configPath}. Please fix it manually.`)
      process.exit(1)
    }
  }

  const existingEnv =
    typeof existing.env === "object" && existing.env !== null
      ? (existing.env as Record<string, string>)
      : {}

  const merged = {
    ...existing,
    env: {
      ...existingEnv,
      ANTHROPIC_BASE_URL: "http://localhost:4141",
      ANTHROPIC_AUTH_TOKEN: "Powered by xc copilot",
    },
    model: "opus[1m]",
  }

  await writeFile(configPath, JSON.stringify(merged, null, 2) + "\n", "utf-8")
  consola.success(`Claude Code configured: ${configPath}`)
}

/**
 * Set or replace a top-level key in a TOML string.
 * If the key exists, its value is updated in place. Otherwise appended after
 * the last existing top-level key (before the first [section]).
 */
function setTomlTopLevelKey(
  content: string,
  key: string,
  value: string,
): string {
  const pattern = new RegExp(`^${key}\\s*=.*$`, "m")
  const line = `${key} = ${JSON.stringify(value)}`

  if (pattern.test(content)) {
    return content.replace(pattern, line)
  }

  // Insert before the first [section] header, or append at end
  const sectionMatch = content.match(/^\[/m)
  if (sectionMatch?.index !== undefined) {
    return (
      content.slice(0, sectionMatch.index) +
      line +
      "\n" +
      content.slice(sectionMatch.index)
    )
  }
  return content.trimEnd() + "\n" + line + "\n"
}

/**
 * Set or replace an entire [section] block in a TOML string.
 * Replaces everything from the header to the next section (or EOF).
 */
function setTomlSection(
  content: string,
  header: string,
  body: string,
): string {
  const escaped = header.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  // Match the section header and all content up to the next section or EOF
  const pattern = new RegExp(`^\\[${escaped}\\]\\n[^[]*`, "m")
  const block = `[${header}]\n${body}\n\n`

  if (pattern.test(content)) {
    return content.replace(pattern, block)
  }
  return content.trimEnd() + "\n\n" + block
}

async function configureCodex(): Promise<void> {
  const configDir = join(homedir(), ".codex")
  const configPath = join(configDir, "config.toml")

  await mkdir(configDir, { recursive: true })

  let content = ""
  try {
    content = await readFile(configPath, "utf-8")
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      consola.error(`Failed to read ${configPath}. Please fix it manually.`)
      process.exit(1)
    }
  }

  content = setTomlTopLevelKey(content, "model", "gpt-5.4")
  content = setTomlTopLevelKey(content, "model_provider", "copilot-api")
  content = setTomlSection(
    content,
    "model_providers.copilot-api",
    'name = "copilot-api"\nbase_url = "http://localhost:4141/v1"\nwire_api = "responses"',
  )

  await writeFile(configPath, content, "utf-8")
  consola.success(`Codex CLI configured: ${configPath}`)
}

export const config = defineCommand({
  meta: {
    name: "config",
    description:
      "Configure external AI tools (Claude Code, Codex CLI) to use Copilot API",
  },
  args: {
    claude: {
      alias: "c",
      type: "boolean",
      default: false,
      description: "Configure Claude Code (~/.claude/settings.json)",
    },
    codex: {
      alias: "x",
      type: "boolean",
      default: false,
      description: "Configure Codex CLI (~/.codex/config.toml)",
    },
  },
  async run({ args }) {
    if (!args.claude && !args.codex) {
      consola.error("Specify at least one: --claude or --codex")
      process.exit(1)
    }

    if (args.claude) {
      await configureClaude()
    }

    if (args.codex) {
      await configureCodex()
    }
  },
})
