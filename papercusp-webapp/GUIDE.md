# papercusp-webapp — composition GUIDE

**Papercusp Official: Web App.** This is an **app-scope** template — the
starting point for a WHOLE web app, exactly as `desktop-app` is for a
desktop app. It is a THIN pure composition: no components of its own; its
hard `requires` pull in the web chassis + data + UI closure:

- **`papercusp-web-host`** — the web chassis: Next.js app-router host built
  standalone (tracing root + workspace transpile), operator.json discovery,
  the auth seam (stubs to replace), Dockerfile deploy skeleton, serial-PG
  test rig. Extracted from the Restart webapp — the first project built on
  papercusp.
- **`papercusp-data-layer`** — the app-owned data plane: Postgres booted
  with (or provisioned for) the app, migrations on boot, connection
  discovery (env → discovery file → fallback), and typed-contract gates on
  trust-boundary writes.
- **`papercusp-ui`** — the operator-style SPA kit: headless primitives, the
  papergrid data-grid stack, the dock-workbench panel shell, and
  brand-lexicon terminology.

Need agents? Do NOT bolt them on here — layer `papercusp-ops-hives` onto
this composition the way `agentic-desktop-app` layers onto `desktop-app`.

## MUST — consult the live papercusp docs when this GUIDE is not enough

You are building ON a live papercusp install (we dogfood papercusp in
papercusp). If anything in this GUIDE is insufficient — a component's API, a
seam convention, a deploy step — do NOT guess:

- read the papercusp documentation served on your install at **`/internal/docs`**
  (start with the `agent-insights` section; this template's `template.yaml`
  `docs:` list names its canonical pages — including the Restart audit that
  this template was extracted from), and
- inspect the **operator app** itself — it is a running reference instance
  of every pattern these templates encode.

## How to build from this (orientation)

1. **Answer `tenancy` FIRST** — single-user local install (papercusp-style,
   embedded PG per install) vs multi-user server deployment (one PG, real
   auth, sessions). Auth strategy, connection resolution, and the hosting
   target all fork here; every later decision assumes this one.
2. **Answer `domain`** — the noun the app ledgers and surfaces. Every
   aspect-level decision point (schema, panels, lexicon terms, searchable
   surfaces) derives from it.
3. **Expand the requires closure** (`resolveRequiresClosure` in
   `@papercusp/template-kit`) and work each aspect's GUIDE in dependency
   order: web-host → data-layer → ui.
4. **Decide `optional-planes`**: live UI sync → add `papercusp-data-sync`;
   search over app data → add `papercusp-search`. Both drop onto this
   chassis; add them to the composition NOW if the app needs them — a
   retrofit costs more.
5. **Wire the checks union**: the composed app must pass the UNION of every
   composed template's `checks/` — `composition-integrity` proves the plan;
   the aspect checks (`boot-e2e` from web-host, `components-integrated` from
   data-layer/ui and any optional plane) prove the build.

## MUST

- Keep this template THIN: an app-scope template adds glue guidance and
  decision points, never its own components — capability belongs in aspects.
- The composed app passes the FULL union of the closure's checks: `boot-e2e`
  (web-host), `components-integrated` (data-layer, ui, and any optional
  plane), and `composition-integrity` (the set itself).
- No agent-orchestration surfaces in an app built from THIS template — no
  hives, no seam. If the requirement appears mid-build, add
  `papercusp-ops-hives` to the composition explicitly instead of hand-rolling
  agents.
- Replace the web-host auth placeholders before any non-local exposure.

## SHOULD

- Ship the Dockerfile deploy path from day one — a web app you cannot
  reproducibly deploy is a prototype.
- Keep UI + API in the one web-host process; reach for a separate service
  only when the domain genuinely demands it.

## FREE

- Everything domain: schema, routes, panels, grids, brand pack, which
  optional planes exist, rendering split, and all styling.

## Checks

`checks/composition-integrity.test.ts` — validates the composition PLAN
(set coherent, pins consistent, exactly one app scope, full union-of-checks).
Runs unconfigured against sibling `templates/<id>/` dirs, or configured via
the `composition.templateYamls` section; see `checks/README.md`.
