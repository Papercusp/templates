# agentic-desktop-app — composition GUIDE (template #1)

**You are the building agent.** Someone said *"build me an app for X using
this template."* This is the **app-scope** template, and it is a LAYER
(P-022) — it carries no components of its own. Your job is to compose:

1. [`desktop-app`](../desktop-app/GUIDE.md) — the required **BASE app**: the
   whole non-agentic desktop app, whose own requires-closure brings the
   [`tauri-desktop-shell`](../tauri-desktop-shell/GUIDE.md) chassis (Tauri
   shell → Node/Hono sidecar → embedded PG → release kit),
   [`papercusp-data-layer`](../papercusp-data-layer/GUIDE.md), and
   [`papercusp-ui`](../papercusp-ui/GUIDE.md), and
2. [`papercusp-ops-hives`](../papercusp-ops-hives/GUIDE.md) — the judgment
   plane (domain hive + -ops hive + the ONE work_items⇄contract seam),

into ONE two-plane app — the proven two-plane ops shape. A
required base app joins the composition without owning it — THIS template is
the root (`composeTemplates`' root-app rule). You compose **freely** — the
old deterministic generator is gone on purpose — and "done" is the **union
of the full closure's checks going green** (`composeTemplates` in
`@papercusp/template-kit` computes the union; that additive rule is what
keeps free-form composition safe).

## MUST — consult the live papercusp docs when this GUIDE is not enough

You are building ON a live papercusp install (we dogfood papercusp in
papercusp). If anything in this GUIDE is insufficient — a component's API, a
seam convention, a release step — do NOT guess:

- read the papercusp documentation served on your install at **`/internal/docs`**
  (start with the `agent-insights` section; this template's `template.yaml`
  `docs:` list names its canonical pages), and
- inspect the **operator app** itself — it is a running reference instance of
  every pattern these templates encode.

## MUST

- Walk **`domain` first** (below), then EVERY decision point of the closure —
  the base app's and each aspect's — your answers are the ship disclosure
  that makes free composition reviewable. (This template's `domain` and the
  base's `domain` are the SAME question — answer once.)
- Honor every closure member's MUST tiers in full (the seam discipline is
  Tier B — not optional; the chassis shape invariants keep it bootable).
- Validate your composition mechanically: expand this template through
  `resolveRequiresClosure`, run the closure through `composeTemplates` —
  pins consistent, one ROOT app scope (this one; desktop-app is the base) —
  and run the union of checks as your CI gate.

## The one decision point here

| id | The question |
|---|---|
| `domain` | What is the app's domain — the noun the deterministic plane ledgers and the judgment plane reasons about? (e.g. a purchasing-ops app: purchase items → candidates; a market-forecasting app: prospects → signals.) Every aspect-level decision point hangs off this answer. |

## Composition walk

1. Answer `domain`. Name the app (`app-identity`, shell aspect).
2. Build the BASE app (desktop-app GUIDE walk 1–4): the full non-agentic app
   first — chassis boots (`boot-e2e`), data layer resolved, UI surfaces up.
   An app that works WITHOUT its judgment plane is the P-022 layering rule
   made practical.
3. Design the seam (ops-hives GUIDE walk 1–2): work-item kind + contract
   package. The contract is the app's most durable artifact — spend judgment
   here.
4. Materialize the blueprints + wire `@papercusp/hive-app-seam` (ops-hives
   walk 3–4).
5. Deterministic domain plane: tables, ingest, read model, UI (`ui-shape`,
   `app-tables`).
6. Green the UNION — the base's closure checks (`boot-e2e` +
   `components-integrated` from data-layer and ui + the base's
   `composition-integrity`) PLUS the judgment plane's (`confinement-guard` +
   `seam-round-trip` + `gym-signals`) plus this template's
   `composition-integrity`. Ship with your decision-point answers disclosed.

## FREE

Everything not claimed MUST by an aspect: domain model, UI, extra hive roles,
extra deterministic packages, additional aspects (compose more templates —
the union rule extends). Prefer extending a catalog component over rolling a
parallel one (reuse-first).
