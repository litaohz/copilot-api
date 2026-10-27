import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

test("Node HTTP requests survive body completion and cancel on client disconnect", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "systemone-node-"))
  const outfile = path.join(directory, "probe.mjs")
  try {
    const build = await Bun.build({
      entrypoints: [path.join(import.meta.dir, "fixtures/systemone-node.ts")],
      target: "node",
      format: "esm",
      outdir: directory,
      naming: "probe.mjs",
    })
    expect(build.success).toBe(true)
    const process = Bun.spawn(["node", outfile], {
      stdout: "pipe",
      stderr: "pipe",
    })
    const deadline = setTimeout(() => process.kill(), 8000)
    try {
      const [stdout, stderr, status] = await Promise.all([
        new Response(process.stdout).text(),
        new Response(process.stderr).text(),
        process.exited,
      ])
      expect({ status, stderr }).toEqual({ status: 0, stderr: "" })
      expect(stdout).toContain("NODE_SYSTEMONE_OK")
    } finally {
      clearTimeout(deadline)
    }
  } finally {
    await fs.rm(outfile, { force: true })
    await fs.rmdir(directory)
  }
}, 15000)
