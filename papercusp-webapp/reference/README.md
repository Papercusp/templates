# reference/ — worked examples

Pointers, not copies (the living repos are the truth):

- **Restart `apps/web`** — the ORIGIN of the web chassis (the first project
  built on papercusp; private repo `aviynw/Restart`). The whole-app shape
  this template generalizes: admin-style Next.js app over `@papercusp/*`
  workspace libs, standalone build, Docker deploy.
- **papercup `apps/operator`** — the papercusp-native reference instance:
  operator-style panels, grids, live sync, lexicon — everything the
  `papercusp-ui` / `papercusp-data-sync` aspects package.
- **Sibling shape**: `templates/desktop-app/` — the desktop twin of this
  template; same thin-composition discipline, tauri chassis instead of web.
- **Audit / design of record**:
  `/internal/docs/agent-insights/restart-webapp-audit-papercusp-webapp-template`.
- **Docs**: `/internal/docs/agent-insights/templates-system-design` ·
  `templates-template-yaml`.
