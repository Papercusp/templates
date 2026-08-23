# reference/ — worked examples

What every builder can rely on, wherever this template was cloned from:

- **The desktop twin's worked example** —
  `../../papercusp-agentic-desktop-app/reference/worked-example.checks-config.json`
  is a COMPLETE `TEMPLATE_CHECKS_CONFIG` for a two-plane app (a
  purchasing-ops domain; schema: `@papercusp/template-kit`
  `TemplateChecksConfig`): confinement lists, the seam section with real
  fixtures, component pins, boot + gym. The seam/confinement/gym sections
  carry over to the web shape unchanged; the boot section points at the
  web-host health endpoint instead of a desktop shell.
- **Your papercusp install** — the operator app is a running papercusp-native
  reference; the docs at `/internal/docs` (start with `agent-insights`) are
  the design record.
- **Sibling templates**: `../../papercusp-webapp/` (the non-agentic BASE this
  template requires) · `../../papercusp-ops-pots/` (the judgment plane it
  layers on, with starter blueprints + the contract template) ·
  `../../papercusp-agentic-desktop-app/` (the desktop twin — same two-plane
  discipline, tauri chassis instead of web).
- **Docs**: `/internal/docs/agent-insights/templates-system-design` ·
  `templates-template-yaml`.
