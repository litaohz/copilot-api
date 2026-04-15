# Changelog

All notable changes to this project will be documented in this file.

## [1.2.0] - 2026-04-16

### Added
- `config` subcommand to configure external AI tools directly
  - `--claude` / `-c`: write/merge Claude Code config (`~/.claude/settings.json`)
  - `--codex` / `-x`: write/merge Codex CLI config (`~/.codex/config.toml`)
  - Supports merging with existing config files without overwriting user settings

### Removed
- `--claude-code` flag from `start` command (replaced by `config --claude`)
- `clipboardy` and `tiny-invariant` dependencies

## [1.1.3] - 2026-04-15

### Fixed
- Enhanced beta header handling and logging for Anthropic 1M models

## [1.1.2] - 2026-04-14

### Fixed
- Daemon uses `npx -y xc-copilot-api@latest` for reliable auto-update

## [1.1.0] - 2026-04-13

### Added
- Daemon management (`xc-copilot-api-daemon`) with install/uninstall/status/restart/stop/logs subcommands
- Windows support for daemon (Task Scheduler)
- macOS support for daemon (launchd)
- Linux support for daemon (systemd)

### Changed
- Split monolithic daemon.ts into per-OS modules (macos.ts, linux.ts, windows.ts)
- Use Task Scheduler instead of Registry Run Key on Windows
- Replace deprecated `wmic` with `Get-CimInstance` on Windows

## [1.0.0] - 2026-04-10

### Added
- Fork from copilot-api, renamed to `xc-copilot-api`
- Passthrough support for Claude and ChatGPT requests
- OpenAI Responses API support
- Token refresh logic for chat completions and passthrough requests
- `--version` CLI option
- Request logging with timestamps

### Fixed
- Claude Code billing header (`cache_control.ephemeral.scope`)
- Docker entrypoint error on Windows (LF line endings)
- Read version from package.json instead of env variable
