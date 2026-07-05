# reference/ — worked examples

Pointers, not copies (the living repos are the truth):

- **Restart `apps/web`** — the ORIGIN (the first project built on
  papercusp; private repo `aviynw/Restart`): `next.config.js` (standalone +
  `outputFileTracingRoot` + `transpilePackages`), standalone build/start
  scripts in `package.json`, `middleware.ts` (auth gate stub),
  `auth-proxy.mjs` (basic-auth reverse proxy), `Dockerfile.web`
  (workspace-manifest COPY layer), `vitest.config.ts` (serial-PG rig).
- **papercup `apps/operator`** — the papercusp-native reference instance of
  a Next.js web host on a live install.
- **Audit / design of record**:
  `/internal/docs/agent-insights/restart-webapp-audit-papercusp-webapp-template`
  — what was extracted, what was already migrated, what stayed behind.
- **Docs**: `/internal/docs/agent-insights/templates-system-design` ·
  `templates-component-catalog` · `templates-template-yaml`.
