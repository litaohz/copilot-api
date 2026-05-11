import { Hono } from "hono"
import { html } from "hono/html"

import { state } from "~/lib/state"
import packageJson from "../../../package.json"

export const indexRoute = new Hono()

// eslint-disable-next-line max-lines-per-function
indexRoute.get("/", (c) => {
  const version = process.env.npm_package_version ?? packageJson.version
  const login = state.githubLogin ?? "unknown"
  const accountType = state.accountType

  const format = c.req.query("format")
  const accept = c.req.header("accept") ?? ""
  if (format === "text" || !accept.includes("text/html")) {
    return c.text(
      `Copilot API v${version} - running\nUser: ${login} (${accountType})`,
    )
  }

  const page = html`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Copilot API</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <style>
          :root {
            --bg: #ffffff;
            --bg-elevated: #fafafa;
            --bg-hover: #f4f4f5;
            --border: #e4e4e7;
            --fg: #09090b;
            --fg-muted: #52525b;
            --fg-subtle: #a1a1aa;
            --accent: #2563eb;
            --success: #059669;
            --purple: #9333ea;
          }
          @media (prefers-color-scheme: dark) {
            :root {
              --bg: #0a0a0a;
              --bg-elevated: #111111;
              --bg-hover: #1a1a1a;
              --border: #1f1f1f;
              --fg: #fafafa;
              --fg-muted: #a1a1aa;
              --fg-subtle: #71717a;
              --accent: #3b82f6;
              --success: #10b981;
              --purple: #a855f7;
            }
          }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            background: var(--bg);
            color: var(--fg);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            padding: 64px 16px;
            -webkit-font-smoothing: antialiased;
          }
          .container { max-width: 560px; width: 100%; }
          .header { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
          .logo {
            width: 36px; height: 36px;
            border-radius: 10px;
            background: linear-gradient(135deg, var(--accent), var(--purple));
            display: flex; align-items: center; justify-content: center;
          }
          h1 { font-size: 1.25rem; font-weight: 600; letter-spacing: -0.01em; }
          .badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 2px 10px;
            border-radius: 9999px;
            font-size: 0.6875rem;
            font-weight: 500;
            background: var(--bg-elevated);
            color: var(--success);
            border: 1px solid var(--border);
            margin-left: 8px;
          }
          .badge::before {
            content: "";
            width: 6px; height: 6px;
            border-radius: 50%;
            background: var(--success);
          }
          .subtitle {
            color: var(--fg-subtle);
            font-size: 0.8125rem;
            margin-bottom: 32px;
            font-family: "JetBrains Mono", ui-monospace, monospace;
          }
          .subtitle a {
            color: var(--fg-subtle);
            text-decoration: none;
            border-bottom: 1px dashed var(--fg-subtle);
          }
          .subtitle a:hover { color: var(--fg-muted); }
          .section {
            background: var(--bg-elevated);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 16px;
          }
          .section-title {
            font-size: 0.6875rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--fg-subtle);
            margin-bottom: 14px;
            font-weight: 500;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            font-size: 0.875rem;
          }
          .info-label { color: var(--fg-muted); }
          .info-value { color: var(--fg); font-weight: 500; }
          .info-value a { color: var(--accent); text-decoration: none; }
          .info-value a:hover { text-decoration: underline; }
          .links { display: flex; flex-direction: column; gap: 6px; }
          .link-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 14px;
            border-radius: 8px;
            text-decoration: none;
            color: var(--fg);
            font-size: 0.875rem;
            transition: background 0.15s;
          }
          .link-item:hover { background: var(--bg-hover); }
          .link-icon {
            width: 32px; height: 32px;
            border-radius: 8px;
            background: var(--bg-hover);
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--fg-muted);
            flex-shrink: 0;
          }
          .link-title { font-weight: 500; }
          .link-desc {
            color: var(--fg-subtle);
            font-size: 0.75rem;
            margin-top: 2px;
          }
          .link-arrow {
            margin-left: auto;
            color: var(--fg-subtle);
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
            <h1>Copilot API <span class="badge">running</span></h1>
          </div>
          <p class="subtitle">
            v${version} ·
            <a href="/?format=text">plain text</a>
          </p>

          <div class="section">
            <div class="section-title">Account</div>
            <div class="info-row">
              <span class="info-label">GitHub User</span>
              <span class="info-value">
                <a href="https://github.com/${login}" target="_blank">${login}</a>
              </span>
            </div>
            <div class="info-row">
              <span class="info-label">Plan</span>
              <span class="info-value">${accountType}</span>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Dashboard</div>
            <div class="links">
              <a class="link-item" href="https://billxc.github.io/copilot-api/?endpoint=${c.req.url.replace(/\/$/, "")}" target="_blank">
                <div class="link-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>
                  </svg>
                </div>
                <div>
                  <div class="link-title">Open Dashboard</div>
                  <div class="link-desc">Usage, models, and config examples</div>
                </div>
                <svg class="link-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M7 17L17 7M17 7H7M17 7V17"/>
                </svg>
              </a>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Resources</div>
            <div class="links">
              <a class="link-item" href="https://github.com/billxc/copilot-api" target="_blank">
                <div class="link-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.4 3-.405 1.02.005 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
                  </svg>
                </div>
                <div>
                  <div class="link-title">GitHub</div>
                  <div class="link-desc">Source code &amp; documentation</div>
                </div>
                <svg class="link-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M7 17L17 7M17 7H7M17 7V17"/>
                </svg>
              </a>
              <a class="link-item" href="https://github.com/billxc/copilot-api/issues" target="_blank">
                <div class="link-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                </div>
                <div>
                  <div class="link-title">Report Issue</div>
                  <div class="link-desc">Bugs or feature requests</div>
                </div>
                <svg class="link-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M7 17L17 7M17 7H7M17 7V17"/>
                </svg>
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>`

  return c.html(page)
})
