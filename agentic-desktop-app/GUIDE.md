# agentic-desktop-app — composition GUIDE (template #1)

**You are the building agent.** Someone said *"build me an app for X using
this template."* This is the **app-scope** template: a THIN composition of two
aspects — it carries no components of its own. Your job is to compose:

1. [`tauri-desktop-shell`](../tauri-desktop-shell/GUIDE.md) — the
   deterministic chassis (Tauri shell → Node/Hono sidecar → embedded PG →
   release kit), and
2. [`papercusp-ops-hives`](../papercusp-ops-hives/GUIDE.md) — the judgment
   plane (domain hive + -ops hive + the ONE work_items⇄contract seam),

into ONE two-plane app, the way quartermaster and oddsmith were built. You
compose **freely** — the old deterministic generator is gone on purpose —
and "done" is the **union of all three templates' checks going green**
(`composeTemplates` in `@papercusp/template-kit` computes the union; that
additive rule is what keeps free-form composition safe).

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

- Walk **`domain` first** (below), then EVERY decision point of both aspects —
  your answers are the ship disclosure that makes free composition reviewable.
- Honor both aspects' MUST tiers in full (the seam discipline is Tier B — not
  optional; the chassis shape invariants keep it bootable).
- Validate your composition mechanically: the three `template.yaml`s through
  `composeTemplates` — pins consistent, one app scope — and run the union of
  checks as your CI gate.

## The one decision point here

| id | The question |
|---|---|
| `domain` | What is the app's domain — the noun the deterministic plane ledgers and the judgment plane reasons about? (quartermaster: purchase items → candidates; oddsmith: market prospects → signals.) Every aspect-level decision point hangs off this answer. |

## Composition walk

1. Answer `domain`. Name the app (`app-identity`, shell aspect).
2. Build the chassis (shell GUIDE walk 1–4): boot skeleton first — an app that
   starts, serves the SPA, and passes `boot-e2e` before any judgment plane.
3. Design the seam (ops-hives GUIDE walk 1–2): work-item kind + contract
   package. The contract is the app's most durable artifact — spend judgment
   here.
4. Materialize the blueprints + wire `@papercusp/hive-app-seam` (ops-hives
   walk 3–4).
5. Deterministic domain plane: tables, ingest, read model, UI (`ui-shape`,
   `app-tables`).
6. Green the UNION: `boot-e2e` + `confinement-guard` + `seam-round-trip` +
   `gym-signals` + `composition-integrity`. Ship with your decision-point
   answers disclosed.

## FREE

Everything not claimed MUST by an aspect: domain model, UI, extra hive roles,
extra deterministic packages, additional aspects (compose more templates —
the union rule extends). Prefer extending a catalog component over rolling a
parallel one (reuse-first).
