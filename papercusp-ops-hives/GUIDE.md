# papercusp-ops-hives — composition GUIDE

**You are the building agent.** This aspect composes the **judgment plane**
into an app: a domain hive + an `-ops` hive over it, joined to the
deterministic app at **exactly one seam**. It was reverse-engineered from two
real apps built this way — the proven two-plane ops shape. Read
`template.yaml` for what exists; this file is how to think about composing it.
You compose **freely and non-deterministically**; "done" is defined by
`checks/` going green (union rule: your app must pass EVERY composed
template's checks).

Worked examples to keep open while you build: the starter blueprints +
contract template in THIS template (`blueprints/`, `contracts/`) and the
worked checks-config `reference/README.md` points at.

## MUST — consult the live papercusp docs when this GUIDE is not enough

You are building ON a live papercusp install (we dogfood papercusp in
papercusp). If anything in this GUIDE is insufficient — a component's API, a
seam convention, a release step — do NOT guess:

- read the papercusp documentation served on your install at **`/internal/docs`**
  (start with the `agent-insights` section; this template's `template.yaml`
  `docs:` list names its canonical pages), and
- inspect the **operator app** itself — it is a running reference instance of
  every pattern these templates encode.

## The construction (orientation)

Two planes. The **deterministic plane** (ordinary code: ingest, storage,
drivers, ledgers) stays code and is NEVER in a blueprint's reach. The
**judgment plane** (this aspect) is papercusp hives: a per-item member
pipeline placed by an `-ops` hive Queen (width = parallel items, depth = 1 per
member). They meet at ONE seam: `work_items` of your declared kind go UP; your
typed contract comes DOWN through a single parse gate into an app table.

## MUST (Tier B — the seam discipline; non-negotiable)

1. **Compose `@papercusp/hive-app-seam` for every crossing** — first-run hive
   bootstrap (`ensureAppHives`), the domain work-items transport
   (`buildDomainWorkItemsSeam`), the ingest loop (`startIngestLoop`). Do not
   hand-roll fetch calls against `/api/harness/*` — the seam component IS the
   blessed primitive (that's what buys observability, Queen dispatch, and
   confinement). Supply chain: the package is vendored in the public
   templates mirror as `hive-app-seam/` — `file:`-link it like the kit
   (`"@papercusp/hive-app-seam": "file:../<mirror-clone>/hive-app-seam"`;
   templates README § Supply chain).
2. **Own contracts package, ONE parse gate** — specialize
   `contracts/candidate-set.ts` into e.g. `@yourapp/contracts`: `.strict()`
   zod schemas both directions; the join key round-trips unchanged; an empty
   result requires notes; money is integer cents; the parse gate is the ONLY
   path from agent output to an app table; a reject emits
   `<workUnit>.rejected` UP as an event — never a silent drop.
3. **Confinement is inviolable and enforced at install** — every hive role is
   read + propose-only against the app's dangerous surface; pinned via role
   capability envelopes (the proven `ops-guard` pattern) across EVERY role.
   Your app's **`blueprints/README.md` is the canonical statement of the
   rule** (materialize it from `blueprints/README.md` here) — every doc points
   at it, nothing restates it.
4. **Nothing else crosses.** No second transport, no side-channel table
   writes, no direct DB access from a role.

## SHOULD (the proven shape — deviate only with a reason you can state)

- **Queen/bee dispatch, not an orchestrator loop**: the `-ops` hive extends
  `work`; the Queen places ONE member harness per open item; `knobs.width` is
  the ONE scaling knob. `dispatch.concurrency: 1` in the member — depth over
  fan-out. Consider `ensembleN` only for high-variance judgment (forecasting:
  yes; fetch-and-verify sourcing: no).
- **Judge acceptance** for repo-less members: a rubric with ~3 weighted
  dimensions scoring match fidelity, evidence liveness, and value accuracy
  against declared constraints (see both starter blueprints).
- **Gym signals in four classes** (rename per domain): `no-<danger>-reach`,
  `<workUnit>-has-evidence`, `<constraint>-honored`, `schema-clean-output`.
  `collectTrace: work-item-output` (repo-less = no git diff).
- **A reactive ingest-sentinel** on `<workUnit>.rejected` — a refused payload
  means an item silently has no output until someone acts.
- **A finalize learning pass**: when the real-world outcome lands, score it
  against the proposal and update member trust weights (the worked shape's
  `sourcing-reviewer` role).
- **Backlog triage on a cadence**: stuck-wip release, escalation surfacing,
  duplicate closing.

## Decision points (declared judgment — answer each, disclose your answers)

| id | The question |
|---|---|
| `seam-work-item-kind` | What work_item kind crosses the seam? (worked instances: `purchase-research`, `bet-analysis`) |
| `contract-shape` | What does the down-leg contract carry? Specialize the starter, keep its invariants. |
| `domain-lexicon` | Domain nouns/verbs for hives, roles, work (replaces every `{{…}}` in the starters). |
| `domain-roles` | Which roles beyond the proven trio (reviewer / sentinel / triage), with what envelopes? |
| `app-tables` | Which app tables does ingested output land in; what read model over them? |

## FREE (genuinely yours)

Role prompts' wording, extra reactive rules, rubric dimensions + weights,
width default, memory conventions, additional cadence roles — anything not
MUST above. The failure mode to guard is *illegible* improvisation: whatever
you choose, your decision-point answers make it reviewable.

## Composition walk (suggested order)

1. Walk the decision points; write the answers down (they go in your ship
   disclosure).
2. Specialize `contracts/candidate-set.ts` → your contracts package + its
   tests (round-trip every schema; reject fixtures for each MUST invariant).
3. Materialize `blueprints/` (README + ops-hive + member), replacing every
   `{{…}}` token — grep for `{{` to prove none survive.
4. Wire the app side with `@papercusp/hive-app-seam` (bootstrap at sidecar
   boot behind an env gate; enqueue on your trigger; ingest loop through the
   parse gate; rejects → events).
5. Run this template's `checks/` (+ every composed template's) until green.
