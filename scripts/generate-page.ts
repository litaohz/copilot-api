// Generates src/routes/index/page.ts from docs/index.html so the local
// server bundles the same dashboard hosted on GitHub Pages. The placeholder
// <!--VERSION_BADGE--> becomes a template hole the route fills in with a
// server-rendered version pill.
import { readFileSync, writeFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const html = readFileSync(join(root, "docs/index.html"), "utf-8")

const escaped = html
  .replace(/\\/g, "\\\\")
  .replace(/`/g, "\\`")
  .replace(/\$\{/g, "\\${")

const templated = escaped.replace("<!--VERSION_BADGE-->", "${versionBadge}")

const out =
  `// AUTO-GENERATED from docs/index.html. Do not edit.\n` +
  `export const renderDashboard = (versionBadge: string): string => \`${templated}\`\n`

writeFileSync(join(root, "src/routes/index/page.ts"), out)
