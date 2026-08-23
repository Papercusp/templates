# papercusp-agentic-webapp — composition GUIDE

**You are the building agent.** Someone said *"build me an agentic web app
for X using this template."* This is the **app-scope** template — the browser
twin of `papercusp-agentic-desktop-app` — and it is a LAYER: it carries no
components of its own. Your job is to compose:

1. [`papercusp-webapp`](../papercusp-webapp/GUIDE.md) — the required **BASE app**: the whole
   non-agentic web app, whose own requires-closure brings the
   [`papercusp-web-host`](../papercusp-web-host/GUIDE.md) chassis (Next.js
   standalone host, operator.json discovery, auth seam, Dockerfile deploy
   skeleton), [`papercusp-data-layer`](../papercusp-data-layer/GUIDE.md), and
   [`papercusp-ui`](../papercusp-ui/GUIDE.md), and
2. [`papercusp-ops-pots`](../papercusp-ops-pots/GUIDE.md) — the judgment
   plane (domain hive + -ops hive + the ONE work_items⇄contract seam),

into ONE two-plane app — the proven two-plane ops shape, on the web chassis. A
required base app joins the composition without owning it — THIS template is
the root (`composeTemplates`' root-app rule). You compose **freely** — there
is no deterministic generator — and "done" is the **union of the full
closure's checks going green** (`composeTemplates` in
`@papercusp/template-kit` computes the union; that additive rule is what
keeps free-form composition safe).

## MUST — consult the live papercusp docs when this GUIDE is not enough

You are building ON a live papercusp install (we dogfood papercusp in
papercusp). If anything in this GUIDE is insufficient — a component's API, a
seam convention, a deploy step — do NOT guess:

- read the papercusp documentation served on your install at **`/internal/docs`**
  (start with the `agent-insights` section; this template's `template.yaml`
  `docs:` list names its canonical pages), and
- inspect the **operator app** itself — it is a running reference instance of
  every pattern these templates encode.

## MUST

- Walk the base's **`tenancy` fork FIRST** (single-user local install with
  embedded PG vs multi-user server deployment — auth strategy, connection
  resolution, and the hosting target all fork there), then **`domain`**
  (below), then EVERY decision point of the closure — the base app's and each
  aspect's — your answers are the ship disclosure that makes free composition
  reviewable. (This template's `domain` and the base's `domain` are the SAME
  question — answer once.)
- Honor every closure member's MUST tiers in full (the seam discipline is
  Tier B — not optional; the web-host auth placeholders are replaced before
  any non-local exposure).
- Validate your composition mechanically: expand this template through
  `resolveRequiresClosure`, run the closure through `composeTemplates` —
  pins consistent, one ROOT app scope (this one; papercusp-webapp is the
  base) — and run the union of checks as your CI gate.

## The one decision point here

| id | The question |
|---|---|
| `domain` | What is the app's domain — the noun the deterministic plane ledgers and the judgment plane reasons about? (e.g. a purchasing-ops app: purchase items → candidates; a market-forecasting app: prospects → signals.) Every aspect-level decision point hangs off this answer. |

## Composition walk

1. Answer the base's `tenancy` fork, then `domain`. Name the app.
2. Build the BASE app (papercusp-webapp GUIDE walk 1–5): the full non-agentic
   web app first — chassis boots (`boot-e2e`), data layer resolved, UI
   surfaces up, optional planes (`papercusp-data-sync`, `papercusp-search`)
   composed NOW if the app needs them. An app that works WITHOUT its
   judgment plane is the layering rule made practical.
3. Design the seam (ops-hives GUIDE walk 1–2): work-item kind + contract
   package. The contract is the app's most durable artifact — spend judgment
   here.
4. Materialize the blueprints + wire `@papercusp/pot-app-seam` (ops-hives
   walk 3–4; the package is vendored in the mirror as `pot-app-seam/` —
   README § Supply chain).
5. Deterministic domain plane: tables, ingest, read model, UI.
6. Green the UNION — the base's closure checks (`boot-e2e` from web-host +
   `components-integrated` from data-layer and ui + the base's
   `composition-integrity`) PLUS the judgment plane's (`confinement-guard` +
   `seam-round-trip` + `gym-signals`) plus this template's
   `composition-integrity`. Ship with your decision-point answers disclosed.

## Checks

**MUST — wire the vendored kit before you run `composition-integrity`.** That
check imports `@papercusp/template-kit`, which is **not on npm**. It ships WITH
this template: `template-kit/` was copied into your app root alongside
`checks/`. Declare it and it resolves after a plain `npm install`:

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

## FREE

Everything not claimed MUST by an aspect: domain model, UI, extra hive roles,
extra deterministic packages, additional aspects (compose more templates —
the union rule extends). Prefer extending a catalog component over rolling a
parallel one (reuse-first).
