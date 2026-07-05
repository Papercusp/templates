# reference/ — worked examples

What every builder can rely on, wherever this template was cloned from:

- **Worked checks-config**:
  [`../../agentic-desktop-app/reference/worked-example.checks-config.json`](../../agentic-desktop-app/reference/worked-example.checks-config.json)
  — its `boot` section configures this template's `boot-e2e` check (attach
  mode against a live app; use spawn mode in CI).
- **Your papercusp install** — the operator app is a running papercusp-native
  reference instance; the docs at `/internal/docs` (start with
  `agent-insights`) are the design record.
- **Sibling shape**: `../../papercusp-web-host/` — the web twin of this
  chassis; same discovery-file + graceful-shutdown lifecycle, Next.js
  standalone host instead of Tauri.
- **Docs**: `/internal/docs/agent-insights/templates-system-design` ·
  `templates-component-catalog` · `templates-template-yaml`.
