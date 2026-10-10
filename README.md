# FSD unified service and dashboard

The maintained FSD deployment now lives in this repository, including proxy
source, multi-key statistics, GPT-6 streaming compatibility and the static
`dashboard/`. See [deployment/README.md](deployment/README.md) for the exact
production baseline, verification command, repository history and known issues.

The Cursor model proxy is maintained here as a pinned CLIProxyAPIPlus sidecar at
`/cursor/v1/`. See [deployment/cursor/README.md](deployment/cursor/README.md) for
client setup, service configuration and deployment. Its credentials are separate;
the Copilot dashboard does not currently aggregate Cursor traffic.

The checked-in `dist/` files preserve the running production version. Build new
candidates outside that directory when checking changes. Runtime behavior must
be implemented in `src/`; do not apply new minified-bundle patches from the old
`edge-proxy-dashboard` repository.

---

# Copilot API Proxy

> **Fork Notice:**  
> The original project by [ericc-ch](https://github.com/ericc-ch/copilot-api) is no longer actively maintained. This fork by [billxc](https://github.com/billxc/copilot-api) updates the project for personal use, adding native passthrough support for the Responses API and Claude API.

> [!WARNING]
> This is a reverse-engineered proxy of GitHub Copilot API. It is not supported by GitHub, and may break unexpectedly. Use at your own risk.

> [!WARNING]
> **GitHub Security Notice:**  
> Excessive automated or scripted use of Copilot (including rapid or bulk requests, such as via automated tools) may trigger GitHub's abuse-detection systems. Use this proxy responsibly to avoid account restrictions.
>
> - [GitHub Acceptable Use Policies](https://docs.github.com/site-policy/acceptable-use-policies/github-acceptable-use-policies#4-spam-and-inauthentic-activity-on-github)
> - [GitHub Copilot Terms](https://docs.github.com/site-policy/github-terms/github-terms-for-additional-products-and-features#github-copilot)

[![爱发电](https://img.shields.io/badge/爱发电-billxc-946ce6?style=for-the-badge)](https://afdian.com/a/billxc)

A reverse-engineered proxy for the GitHub Copilot API that exposes it as an OpenAI and Anthropic compatible service. Use GitHub Copilot with [Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview), [Codex CLI](https://github.com/openai/codex), or any tool that supports the OpenAI / Anthropic API.

> **Note:** If you are using [opencode](https://github.com/sst/opencode), you do not need this project. Opencode supports GitHub Copilot provider out of the box.

## Quick Start

```sh
# 1. Start the server
npx xc-copilot-api@latest start

# 2. Configure your tool
npx xc-copilot-api@latest config --claude    # Claude Code (Opus 4.7)
npx xc-copilot-api@latest config --codex     # Codex CLI (GPT-5.5)
```

That's it. Your tool is now powered by GitHub Copilot.

## Demo

https://github.com/user-attachments/assets/7654b383-669d-4eb9-b23c-06d7aefee8c5

## Features

- **OpenAI & Anthropic Compatibility** — `/v1/chat/completions`, `/v1/responses`, `/v1/messages`, `/v1/embeddings`, `/v1/models`
- **Native Passthrough** — Claude and GPT models are forwarded directly to upstream with full protocol fidelity (tool use, streaming, thinking blocks, vision)
- **One-command Setup** — `config --claude` / `config --codex` writes the right settings automatically
- **Usage Dashboard** — Web UI to monitor quotas and usage statistics
- **Rate Limiting** — `--rate-limit` and `--wait` to stay within GitHub's limits
- **Background Service** — Run as a system service via [easy-service](https://github.com/billxc/easy-service)
- **Multiple Account Types** — Individual, business, and enterprise Copilot plans

## Using with Claude Code

```sh
# Opus 4.7 (default)
npx xc-copilot-api@latest config --claude

# Opus 4.6
npx xc-copilot-api@latest config --claude -m 4.6
```

A backup of your existing config is saved as `settings.json.bak`.

<details>
<summary>Manual configuration</summary>

**Opus 4.7 (default):**

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://localhost:4141",
    "ANTHROPIC_AUTH_TOKEN": "Powered by xc copilot",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "claude-opus-4.7-1m-internal",
    "CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS": "1"
  }
}
```

**Opus 4.6:**

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://localhost:4141",
    "ANTHROPIC_AUTH_TOKEN": "Powered by xc copilot",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "claude-opus-4.6-1m",
    "CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS": "1"
  }
}
```

More options: [Claude Code settings](https://docs.anthropic.com/en/docs/claude-code/settings#environment-variables) · [IDE integration](https://docs.anthropic.com/en/docs/claude-code/ide-integrations)

</details>

## Using with Codex CLI

```sh
npx xc-copilot-api@latest config --codex
```

<details>
<summary>Manual configuration</summary>

Add to `~/.codex/config.toml`:

```toml
model = "gpt-5.5"
model_provider = "copilot-api"

[model_providers.copilot-api]
name = "copilot-api"
base_url = "http://localhost:4141/v1"
wire_api = "responses"
```

</details>

## Command Reference

### Commands

| Command       | Description                                                        |
| ------------- | ------------------------------------------------------------------ |
| `start`       | Start the API server (handles auth automatically)                  |
| `auth`        | Run GitHub auth flow only (for generating tokens for CI/CD)        |
| `config`      | Configure Claude Code or Codex CLI to use this proxy               |
| `check-usage` | Show Copilot usage and quota in the terminal                       |
| `debug`       | Display version, runtime, file paths, and auth status              |

### `start` Options

| Option         | Description                                            | Default    | Alias |
| -------------- | ------------------------------------------------------ | ---------- | ----- |
| --port         | Port to listen on                                      | 4141       | -p    |
| --verbose      | Enable verbose logging                                 | false      | -v    |
| --account-type | Account type (individual, business, enterprise)        | individual | -a    |
| --manual       | Manually approve each request                          | false      |       |
| --rate-limit   | Minimum seconds between requests                       |            | -r    |
| --wait         | Wait instead of error when rate limited                | false      | -w    |
| --github-token | Provide GitHub token directly                          |            | -g    |
| --show-token   | Show tokens on fetch and refresh                       | false      |       |
| --proxy-env    | Initialize proxy from environment variables            | false      |       |
| --api-key      | Require this key on incoming requests (also `COPILOT_API_KEY`) |     | -k    |

### `config` Options

| Option         | Description                                       | Default | Alias |
| -------------- | ------------------------------------------------- | ------- | ----- |
| --claude       | Configure Claude Code (`~/.claude/settings.json`) | false   | -c    |
| --codex        | Configure Codex CLI (`~/.codex/config.toml`)      | false   | -x    |
| --claude-model | Claude Opus model version (4.7 or 4.6)            | 4.7     | -m    |

## API Endpoints

| Endpoint                         | Description                                    |
| -------------------------------- | ---------------------------------------------- |
| `POST /v1/chat/completions`      | OpenAI Chat Completions API                    |
| `POST /v1/responses`             | OpenAI Responses API (native passthrough)      |
| `POST /v1/messages`              | Anthropic Messages API (native passthrough)    |
| `POST /v1/messages/count_tokens` | Anthropic token counting                       |
| `GET  /v1/models`                | List available models                          |
| `POST /v1/embeddings`            | Create embedding vectors                       |
| `GET  /usage`                    | Copilot usage statistics and quota             |
| `GET  /token`                    | Current Copilot token                          |
| `GET  /admin/stats`              | Request/token/IP monitoring snapshot           |
| `POST /admin/pause`              | Pause: all proxy endpoints return 503          |
| `POST /admin/resume`             | Resume from a paused state                     |
| `POST /admin/shutdown`           | Exit the process (process managers restart it) |

### Monitoring & kill switch

When `--api-key` (or `COPILOT_API_KEY`) is set, the `/admin/*` endpoints are
protected by the same key. They are designed for public deployments where you
want visibility and an emergency stop:

- `GET /admin/stats` returns total requests, token usage (per model and total),
  per-source-IP counts (with `authorized` / `unauthorized` / `tokens` breakdown
  so you can spot freeloading or probing), status-code totals, a `droppedNoise`
  counter, and the most recent requests. Stats are persisted to
  `stats.json` in the data dir and survive restarts.
- Internet scanning noise (any path that is not a real API endpoint, e.g.
  `/wp-includes/...`) is dropped before auth — at the nginx edge with `444`
  (connection reset) and at the app with `404` — so it never pollutes stats and
  leaves 401s as a meaningful "wrong key" signal. Source IPs are taken from the
  trusted `X-Real-IP` header set by the reverse proxy, not the spoofable
  `X-Forwarded-For`.
- `POST /admin/pause` flips a reversible kill switch — every proxy request then
  returns `503` while `/admin/*` stays reachable. `POST /admin/resume` restores
  service. Use this for an immediate, reversible stop.
- `POST /admin/shutdown` exits the process. Under pm2/systemd it is restarted
  automatically, so for a permanent stop use the manager (e.g. `pm2 stop`).

```sh
KEY=your-api-key
curl -H "Authorization: Bearer $KEY" http://localhost:4141/admin/stats
curl -X POST -H "Authorization: Bearer $KEY" http://localhost:4141/admin/pause
curl -X POST -H "Authorization: Bearer $KEY" http://localhost:4141/admin/resume
```

## Running as a Background Service

```bash
# Install easy-service
uv tool install git+https://github.com/billxc/easy-service.git

# Install and start
easy-service install copilot-api -- npx -y xc-copilot-api@latest start

# Manage
easy-service status copilot-api
easy-service logs copilot-api -f
easy-service restart copilot-api
easy-service stop copilot-api
easy-service uninstall copilot-api
```

## Running from Source

```sh
bun install        # install dependencies
bun run dev        # development mode
bun run start      # production mode
```

Prerequisites: Bun >= 1.2.x, GitHub account with Copilot subscription.

## Usage Tips

- Use `--rate-limit 30 --wait` to stay within Copilot's rate limits without client errors.
- Use `--account-type business` or `enterprise` if you have a business/enterprise Copilot plan. See [official docs](https://docs.github.com/en/enterprise-cloud@latest/copilot/managing-copilot/managing-github-copilot-in-your-organization/managing-access-to-github-copilot-in-your-organization/managing-github-copilot-access-to-your-organizations-network#configuring-copilot-subscription-based-network-routing-for-your-enterprise-or-organization).
- Use `--manual` to approve each request individually for fine-grained control.
- **Public exposure:** when exposing the server beyond localhost, set `--api-key <key>` (or the `COPILOT_API_KEY` env var) so callers must send `Authorization: Bearer <key>` (or `x-api-key: <key>`). Without a key the endpoints are unauthenticated and anyone who can reach the port can spend your Copilot quota.

<details>
<summary><h2>Using with Docker</h2></summary>

### Pre-built Image

```sh
docker pull ghcr.io/billxc/copilot-api:latest
mkdir -p ./copilot-data
docker run -p 4141:4141 -v $(pwd)/copilot-data:/root/.local/share/copilot-api ghcr.io/billxc/copilot-api:latest
```

Available tags: `latest`, `v*.*.*`, `master`, `<sha>`

### Build from Source

```sh
docker build -t copilot-api .
mkdir -p ./copilot-data
docker run -p 4141:4141 -v $(pwd)/copilot-data:/root/.local/share/copilot-api copilot-api
```

### Environment Variables

```sh
docker run -p 4141:4141 -e GH_TOKEN=your_token copilot-api
```

### Docker Compose

```yaml
version: "3.8"
services:
  copilot-api:
    image: ghcr.io/billxc/copilot-api:latest
    ports:
      - "4141:4141"
    environment:
      - GH_TOKEN=your_github_token_here
    volumes:
      - ./copilot-data:/root/.local/share/copilot-api
    restart: unless-stopped
```

> **Note:** Token data is persisted in `copilot-data` on your host, mapped to `/root/.local/share/copilot-api` inside the container.

</details>

<details>
<summary><h2>Update Log</h2></summary>

### v1.2.3 — Claude Model Selection & Codex 5.5

- **Claude model version selection**: New `--claude-model` (`-m`) option for `config --claude`. Choose between Opus 4.7 (default) and Opus 4.6.
- **Codex default model updated**: `config --codex` now defaults to `gpt-5.5`.
- **Filter unsupported tools in Responses API**: Automatically strips `image_generation` and other unsupported tool types before forwarding to upstream, preventing errors from Codex CLI.
- **Bun idle timeout fix**: Increased `idleTimeout` to 255s to prevent streaming responses from being cut off after 10 seconds.
- **README restructured**: Quick Start first, collapsible Docker/Update Log sections, consolidated command reference.

### v1.2.1 — easy-service & Config Command

- **New `config` subcommand**: One-command setup for Claude Code (`config --claude`) and Codex CLI (`config --codex`).
- **Background service**: Replaced built-in daemon with [easy-service](https://github.com/billxc/easy-service) for cross-platform service management.

### v1.1.x — Anthropic 1M Models

- **Anthropic 1M model support**: Enhanced beta header handling for `claude-opus-4.6-1m` and other 1M context models.

### v1.0.x — Native Passthrough

- **Native passthrough for Responses API and Claude API**: Claude models forward the entire Anthropic Messages request directly to upstream. GPT models forward Responses API requests without transformation.
- **Full protocol fidelity**: Tool use, streaming, thinking blocks, vision — all preserved without translation loss.
- **Fallback translation**: Non-Claude models hitting `/v1/messages` still use the Anthropic-to-OpenAI translation layer.

</details>
