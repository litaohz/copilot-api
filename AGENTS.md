# AGENTS.md

## Build, Lint, and Test Commands

- **Build:**  
  `bun run build` (uses tsdown; for candidate validation use `bun run build --out-dir <temporary-directory>`)
- **Dev:**  
  `bun run dev`
- **Lint:**  
  `bun run lint` (uses @echristian/eslint-config)
- **Lint & Fix staged files:**  
  `bunx lint-staged`
- **Test all:**  
   `bun test`
- **Test single file:**  
   `bun test tests/claude-request.test.ts`
- **Start (prod):**  
  `bun run start`

## Code Style Guidelines

- **Imports:**  
  Use ESNext syntax. Prefer absolute imports via `~/*` for `src/*` (see `tsconfig.json`).
- **Formatting:**  
  Follows Prettier (with `prettier-plugin-packagejson`). Run `bun run lint` to auto-fix.
- **Types:**  
  Strict TypeScript (`strict: true`). Avoid `any`; use explicit types and interfaces.
- **Naming:**  
  Use `camelCase` for variables/functions, `PascalCase` for types/classes.
- **Error Handling:**  
  Use explicit error classes (see `src/lib/error.ts`). Avoid silent failures.
- **Unused:**  
  Unused imports/variables are errors (`noUnusedLocals`, `noUnusedParameters`).
- **Switches:**  
  No fallthrough in switch statements.
- **Modules:**  
  Use ESNext modules, no CommonJS.
- **Testing:**  
   Use Bun's built-in test runner. Place tests in `tests/`, name as `*.test.ts`.
- **Linting:**  
  Uses `@echristian/eslint-config` (see npm for details). Includes stylistic, unused imports, regex, and package.json rules.
- **Paths:**  
  Use path aliases (`~/*`) for imports from `src/`.

---

This file is tailored for agentic coding agents. For more details, see the configs in `eslint.config.js` and `tsconfig.json`. No Cursor or Copilot rules detected.

## FSD production baseline

- This repository owns both the proxy (`src/`) and static monitoring UI (`dashboard/`). Runtime compatibility belongs in the proxy source, never in dashboard-only patch scripts.
- Read `deployment/README.md` before publishing. `dist/main.js` and the two deployed `.mjs` modules are tracked production artifacts; do not overwrite them during routine candidate builds.
- Check `python3 deployment/verify.py --git` for a synchronized checkout; on the VM also pass `--deployed-dashboard /var/www/edge-dash/index.html`.
- Run `bun run typecheck`, `bun run lint`, `bun test` and a build in a temporary directory for source changes. The deployed modules and imported streaming fixtures retain their original bytes and have dedicated behavioral tests.
- Production credentials, PM2 environment files, logs, statistics and private backups are not source code and must never be committed.
