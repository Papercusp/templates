# papercusp-ops-pots — composition GUIDE

**You are the building agent.** This aspect composes Papercusp's agentic work
plane into an app. The app owns a plan template and a stable agent identity;
Papercusp turns each external or scheduled run into visible work items before
the agent does anything. The deterministic app and the agentic plane meet at
**exactly one typed seam**. Read `template.yaml` for the declared pieces and
MUSTs. Composition stays judgment-led; "done" means every check in the
composed closure is green.

Worked examples to keep open while you build: the starter blueprints +
contract template in THIS template (`blueprints/`, `contracts/`) and the
worked checks-config `reference/README.md` points at.

## MUST — consult the live Papercusp docs when this GUIDE is not enough

You are building on a live Papercusp install. If a component API, plan binding,
agent-name lifecycle, seam convention, or release step is unclear, do not
guess:

- read the Papercusp documentation served on your install at **`/internal/docs`**
  (start with the `agent-insights` section; this template's `template.yaml`
  `docs:` list names its canonical pages), and
- inspect the **operator app**, including its built-in Gmail agentic binding,
  as a running reference for app-scoped plan runs and stable-agent dispatch.

## The construction

The deterministic plane owns triggers, storage, drivers, ledgers, and app
tables. The agentic plane owns judgment work expressed as an app-owned plan
template:

```text
external event or schedule
  → app-owned plan run
  → canonical plan-item promotion (inputs + provenance + blocked-by DAG)
  → assign actionable work items to one stable agent name
  → required wake of the live session that adopted that name
  → work-item completion releases and dispatches newly actionable successors
  → typed output crosses one parse gate into an app table
```

The queue is durable. The wake is delivery, not storage. A missing live agent
therefore fails loudly and retryably while the promoted work remains visible.

## MUST (Tier B — non-negotiable)

1. **Use the canonical plan/work-item plane for every agentic run.** Author one
   app-owned plan template with explicit `blocked-by` edges and input schema.
   External bindings and schedules launch that template; they do not insert
   work items directly, call `work_items:create`, or grow an app-local scheduler.
   Canonical promotion preserves the run id, immutable inputs/provenance,
   source plan-item identity, replay idempotency, and DAG edges.
2. **Declare the execution target.** Every agentic external binding or schedule
   carries the same two-field contract:

   ```yaml
   execution:
     appHarnessSlug: "{{APP_HARNESS_SLUG}}"
     agentName: "{{APP_AGENT_NAME}}"
   ```

   For an external `launch-plan` binding this lives at `action.execution`; for
   a recurrence it lives at `schedule.execution` in `plans:set-schedule`.
   `appHarnessSlug` owns the plan run and queue; `agentName` is the durable
   assignee stored on work items.
3. **Keep the stable agent live and adopted.** Launch the app agent from
   `blueprints/app-agent/`, then have its live session call
   `plan_items:adopt_name { name: "{{APP_AGENT_NAME}}" }`. Dispatch assigns only
   the actionable promoted frontier and sends a required wake to the newest
   live session adopting that name. Blocked descendants stay unassigned and
   unwoken until canonical prerequisite completion releases them. A dead,
   absent, or unwakeable target is a structured retryable failure—not success.
4. **Compose `@papercusp/pot-app-seam` for every crossing.** Use
   `ensureAppHives`, `buildDomainWorkItemsSeam`, and `startIngestLoop`; do not
   hand-roll calls against `/api/harness/*`. The seam is vendored inside this
   template, so link `"@papercusp/pot-app-seam": "file:./pot-app-seam"`.
   Never link it from `libs/generic` or an assumed checkout path: materializing
   copies only the selected template directory, and some installs ship no
   source tree.
5. **Own one contracts package and one parse gate.** Specialize
   `contracts/candidate-set.ts` into e.g. `@yourapp/contracts`: `.strict()`
   zod schemas both directions; the join key round-trips unchanged; an empty
   result requires notes; money is integer cents; the parse gate is the ONLY
   path from agent output to an app table; a reject emits
   `<workUnit>.rejected` UP as an event — never a silent drop.
6. **Keep confinement inviolable.** The stable agent is
   read + propose-only against the app's dangerous surface; pinned via role
   capability envelopes (the proven `ops-guard` pattern).
   Your app's **`blueprints/README.md` is the canonical statement of the
   rule** (materialize it from `blueprints/README.md` here) — every doc points
   at it, nothing restates it.
7. **Nothing else crosses.** No second transport, no side-channel table
   writes, no direct DB access from a role.

## SHOULD

- Treat the plan DAG as the execution topology. Parallelism is the number of
  independently actionable items, not a placement-width knob or nested fan-out
  hidden inside a role.
- Keep one stable app-agent name per execution target. A replacement session
  may adopt the same name after restart; durable assignment remains the name,
  while wake delivery resolves the current live session.
- **Judge acceptance** for judgment-heavy items: a rubric with ~3 weighted
  dimensions scoring match fidelity, evidence liveness, and value accuracy
  against declared constraints (see both starter blueprints).
- **Gym signals in four classes** (rename per domain): `no-<danger>-reach`,
  `<workUnit>-has-evidence`, `<constraint>-honored`, `schema-clean-output`.
  `collectTrace: work-item-output` (repo-less = no git diff).
- Model rejected-ingest repair, outcome review, and backlog hygiene as explicit
  plan items or scheduled plans on the same substrate—not a second executor.

## Decision points (declared judgment — answer each, disclose your answers)

| id | The question |
|---|---|
| `seam-work-item-kind` | What work-item kind and id prefix cross the seam? |
| `plan-template` | Which app-owned plan template defines inputs and the blocked-by DAG; what binding or schedule launches it? |
| `execution-target` | Which app harness owns the queue, and which stable agent name adopts assignments and wakes? |
| `contract-shape` | What does the down-leg contract carry? Specialize the starter, keep its invariants. |
| `domain-lexicon` | Domain nouns/verbs for hives, roles, work (replaces every `{{…}}` in the starters). |
| `domain-roles` | What prompt and capability envelope does the stable app agent need? |
| `app-tables` | Which app tables does ingested output land in; what read model over them? |

## FREE (genuinely yours)

Agent prompt wording, the plan's domain-specific phases, rubric dimensions and
weights, memory conventions, and optional scheduled review plans are yours.
The failure mode to guard is *illegible* improvisation: record every
decision-point answer so another engineer can review the resulting work plane.

## Composition walk (suggested order)

1. Answer the decision points and record the choices.
2. Author the app-owned plan template: input schema, phases/items, real
   `blocked-by` edges, and acceptance conditions.
3. Configure the external binding and/or schedule with the same
   `{ appHarnessSlug, agentName }` execution target.
4. Specialize `contracts/candidate-set.ts` and test valid plus rejected payloads.
5. Materialize `blueprints/README.md` and `blueprints/app-agent/blueprint.yaml`,
   replacing every `{{…}}` token; grep for `{{` to prove none remain.
6. Wire the app side through `@papercusp/pot-app-seam`, including reject events.
7. Launch/adopt the stable app agent, then run this template's checks and the
   full composed checks union.
