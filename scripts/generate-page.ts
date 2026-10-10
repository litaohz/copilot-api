// Generates src/routes/index/page.ts from docs/index.html so the local
// server bundles the same dashboard hosted on GitHub Pages. The placeholder
// <!--VERSION_BADGE--> becomes a template hole the route fills in with a
// server-rendered version pill.
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const root = join(import.meta.dirname, "..")
const html = readFileSync(join(root, "docs/index.html"), "utf8")

const escaped = html
  .replaceAll("\\", "\\\\")
  .replaceAll("`", "\\`")
  .replaceAll("${", "\\${")

const templated = escaped.replace("<!--VERSION_BADGE-->", "${versionBadge}")

const out =
  `// AUTO-GENERATED from docs/index.html. Do not edit.\n`
  + `export const renderDashboard = (versionBadge: string): string => \`${templated}\`\n`

writeFileSync(join(root, "src/routes/index/page.ts"), out)
