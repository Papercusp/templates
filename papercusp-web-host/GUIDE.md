# papercusp-web-host — composition GUIDE

**The web app chassis** — the web twin of `tauri-desktop-shell`, extracted
from the **Restart** webapp (the first project built on papercusp;
audit: `/internal/docs/agent-insights/restart-webapp-audit-papercusp-webapp-template`).
Where the desktop chassis is Tauri host → Node/Hono sidecar, this chassis is
one Next.js app-router host serving UI + API routes from a standalone build.
The host is **config/skeleton, not a lib** (the `next-standalone-host`
pattern component) — the heavy web stack already lives in the sibling
aspects (`papercusp-ui`, `papercusp-data-sync`, `papercusp-search`).

## MUST — consult the live papercusp docs when this GUIDE is not enough

You are building ON a live papercusp install (we dogfood papercusp in
papercusp). If anything in this GUIDE is insufficient — a config knob, a
seam convention, a deploy step — do NOT guess:

- read the papercusp documentation served on your install at **`/internal/docs`**
  (start with the `agent-insights` section; this template's `template.yaml`
  `docs:` list names its canonical pages), and
- inspect the **operator app** (`apps/operator` in the papercup repo) — it is
  the papercusp-native reference instance of a Next.js web host; the origin
  reference is Restart `apps/web` (see `reference/README.md`).

## The chassis, piece by piece

1. **Standalone build** (`next.config.js`):
   - `output: 'standalone'` — the build emits a self-contained
     `.next/standalone/` server.
   - `outputFileTracingRoot: <monorepo root>` — REQUIRED in a workspace
     monorepo so `@papercusp/*` libs trace into the bundle. Omitting it is
     the classic miss: dev works, the standalone build 500s on a missing
     workspace module.
   - `transpilePackages: [...]` — name EVERY workspace lib the app imports
     (ui-primitives, grid packages, sync, design tokens, …).
2. **Start scripts** (`package.json`): build = `next build` then copy
   `.next/static` and `public/` into the standalone tree; start =
   `node .next/standalone/<app path>/server.js` with `PORT`/`HOSTNAME` env.
3. **Discovery**: on boot, write the `operator.json` analog (port + pid,
   removed on shutdown) to the app home — same convention as the desktop
   sidecar, so CLI/tooling and the `boot-e2e` check work identically.
   Make the removal the LAST shutdown step and **synchronous**
   (`unlinkSync`, not `await rm`) — under a dev runtime like `tsx` the
   runtime's own signal cleanup can kill the process inside a trailing
   `await`, leaving the file behind (WI-2866).
4. **Auth seam** — two PLACEHOLDERS, by design:
   - `middleware.ts`: a gate stub (401 unless an env bypass) over protected
     matchers — replace with real auth before exposing anything.
   - `auth-proxy.mjs`: a ~40-line basic-auth reverse proxy for pre-release
     demos. It is NOT the app's auth story.
5. **Deploy skeleton** (`Dockerfile`): node-alpine builder; COPY the
   workspace lib manifests first (`COPY --parents libs/*/package.json`) so
   `npm ci` layers cache; build standalone; runtime image carries only the
   standalone tree.
6. **Test rig** (`vitest.config.ts`): node env; when tests share a Postgres,
   run serially (`pool: 'forks'`, `singleFork: true`,
   `fileParallelism: false`) — parallel files racing one test DB is the
   flake factory.

## MUST

- `output: 'standalone'` + `outputFileTracingRoot` + complete
  `transpilePackages` — all three, before first deploy.
- Replace BOTH auth placeholders before any non-local exposure; the
  `auth-strategy` decision point is not optional.
- Write + remove the discovery file on boot/shutdown (the `boot-e2e` check
  pins this lifecycle).
- Wire `checks/boot-e2e.test.ts` in the composed app's
  `TEMPLATE_CHECKS_CONFIG` (section `boot`) — spawn mode in CI.

## SHOULD

- Ship the Dockerfile builder pattern even if v1 deploys bare — the
  workspace-manifest COPY layer is cheap now and painful to retrofit.
- Keep API routes inside the same host (app-router route handlers) — one
  process serves UI + API, mirroring the hono-host discipline.
- Use the serial-PG vitest rig for anything touching the data layer.

## FREE

- Rendering split (SSR vs client per surface), observability wiring
  (instrumentation.ts / OTEL / RUM), docs/MDX tooling, styling — all yours.

## Checks

`checks/boot-e2e.test.ts` — portable, config-driven (section `boot`,
schema `@papercusp/template-kit` `TemplateChecksConfig`): builds (optional
`buildCommand`), spawns the host, waits for discovery + health 200, SIGTERM,
asserts clean exit + discovery cleanup. See `checks/README.md`.
