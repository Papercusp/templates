# papercusp-desktop-app — composition GUIDE

**Papercusp Official: Desktop App.** This is an **app-scope** template — the
starting point for a WHOLE desktop app that does **not** need agent
orchestration. It is a THIN pure composition: no components of its own; its
hard `requires` pull in the full chassis + data + UI closure:

- **`papercusp-tauri-desktop-shell`** — the deterministic chassis: thin Tauri 2 host →
  Node/Hono sidecar (SPA + /api on a free localhost port) → embedded
  Postgres → tauri-release-kit build/release pipeline.
- **`papercusp-data-layer`** — the app-owned data plane: embedded Postgres
  booted with the app, migrations on boot, connection discovery
  (env → discovery file → fallback; the port rotates per boot), and
  typed-contract gates on trust-boundary writes.
- **`papercusp-ui`** — the operator-style SPA kit: headless primitives,
  the papergrid data-grid stack, the dock-workbench panel shell, and
  brand-lexicon terminology.

Need agents? Do NOT bolt them on here — use **`papercusp-agentic-desktop-app`**, which
layers the ops-hives judgment plane onto this same chassis.

## MUST — consult the live papercusp docs when this GUIDE is not enough

You are building ON a live papercusp install (we dogfood papercusp in
papercusp). If anything in this GUIDE is insufficient — a component's API, a
seam convention, a release step — do NOT guess:

- read the papercusp documentation served on your install at **`/internal/docs`**
  (start with the `agent-insights` section; this template's `template.yaml`
  `docs:` list names its canonical pages), and
- inspect the **operator app** itself — it is a running reference instance of
  every pattern these templates encode.

## How to build from this (orientation)

1. **Answer `domain` first** — the noun the app ledgers and surfaces. Every
   aspect-level decision point (schema, panels, lexicon terms, searchable
   surfaces) derives from it.
2. **Expand the requires closure** (`resolveRequiresClosure` in
   `@papercusp/template-kit`) and work each aspect's GUIDE in dependency
   order: shell → data-layer → ui.
3. **Decide `optional-planes`**: live UI sync → add `papercusp-data-sync`;
   search over app data → add `papercusp-search`. Both drop onto this
   chassis; add them to the composition NOW if the app needs them — a
   retrofit costs more.
4. **Wire the checks union**: the composed app must pass the UNION of every
   composed template's `checks/` — that additive rule is the app's
   definition of done (`composition-integrity` proves the plan; the
   aspect checks prove the build).

## MUST

- Keep this template THIN: an app-scope template adds glue guidance and
  decision points, never its own components — capability belongs in aspects.
- The composed app passes the FULL union of the closure's checks: `boot-e2e`
  (shell), `components-integrated` (data-layer, ui, and any optional plane),
  and `composition-integrity` (the set itself).
- No agent-orchestration surfaces in an app built from THIS template — no
  hives, no seam. If the requirement appears mid-build, switch the
  composition root to `papercusp-agentic-desktop-app` instead of hand-rolling agents.

## SHOULD

- Ship the release pipeline from day one (`tauri-release-kit` arrives with
  the shell) — a desktop app without signing/updater wiring is a prototype.
- Keep the SPA inside the sidecar host (`hono-host`); one process serves UI
  + API, the shell stays a host.

## FREE

- Everything domain: schema, panels, grids, brand pack, which optional
  planes exist, and all styling.

## Checks

`checks/composition-integrity.test.ts` — validates the composition PLAN
(set coherent, pins consistent, exactly one app scope, full union-of-checks).
Runs unconfigured against sibling `templates/<id>/` dirs, or configured via
the `composition.templateYamls` section; see `checks/README.md`.

**MUST — wire the vendored kit before you run it.** That check imports
`@papercusp/template-kit`, which is **not on npm**. It ships WITH this
template: `template-kit/` was copied into your app root alongside `checks/`.
Declare it and it resolves after a plain `npm install`:

```jsonc
// your app's package.json
"devDependencies": {
  "@papercusp/template-kit": "file:./template-kit",
  "vitest": "^4.1.4",
  "yaml": "^2.6.0"
}
```

Do NOT `npm install @papercusp/template-kit` (404 — nothing under the
`@papercusp` scope is published) and do NOT point the dep at a papercusp
checkout path: the vendored copy is the supported source, and it is the only
one guaranteed present on every platform.
