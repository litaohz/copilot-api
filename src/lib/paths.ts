import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { state } from "./state"

export const PATHS = {
  get APP_DIR() {
    if (state.dataDir) return path.resolve(state.dataDir)
    const root = path.join(os.homedir(), ".local", "share", "copilot-api")
    return state.githubHost && state.githubHost !== "github.com" ?
        path.join(root, state.githubHost)
      : root
  },
  get GITHUB_TOKEN_PATH() {
    return path.join(this.APP_DIR, "github_token")
  },
}

export async function ensurePaths(): Promise<void> {
  await fs.mkdir(PATHS.APP_DIR, { recursive: true, mode: 0o700 })
  await ensureFile(PATHS.GITHUB_TOKEN_PATH)
}

async function ensureFile(filePath: string): Promise<void> {
  try {
    await fs.access(filePath, fs.constants.W_OK)
  } catch {
    await fs.writeFile(filePath, "", { flag: "wx", mode: 0o600 })
    await fs.chmod(filePath, 0o600)
  }
}
