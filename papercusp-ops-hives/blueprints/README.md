# {{APP_NAME}} blueprints — STARTER (papercusp-ops-hives template)

> **Building agent:** this file becomes YOUR app's `blueprints/README.md` — the
> CANONICAL statement of the confinement rule for your app. Every GUIDE and doc
> points here and never restates it (anti-drift). Replace every `{{…}}` token
> while walking the template's decision points; keep the structure.
> Exemplars: `quartermaster/blueprints/README.md`, `oddsmith/blueprints/README.md`.

The **agentic plane**: papercusp blueprints layered on the deterministic app.
The deterministic planes ({{DETERMINISTIC_PLANES e.g. ingest, approvals,
checkout driver, card vault}}) stay **code** and are never in a blueprint's
reach. The blueprints are the *judgment* layer; they join the app by exactly
one seam — **`work_items`** (kind `{{SEAM_WORK_ITEM_KIND}}`) going up, and the
**`{{CONTRACT_NAME}}` contract** coming back down into the
`{{APP_TABLE}}` table.

## The set

| Blueprint | Kind | Extends | Role |
|---|---|---|---|
| `{{DOMAIN}}-ops` | hive | `work` | The Queen — drains the `{{SEAM_WORK_ITEM_KIND}}` backlog via fleet placement (one member harness per item; width = parallel items). |
| `{{SEAM_WORK_ITEM_KIND}}` | harness | `research` | The per-item member pipeline: director + worker → emits a `{{CONTRACT_NAME}}` (work-item payload). Judge rubric: {{RUBRIC_DIMENSIONS}}. |

## Confinement (inviolable)

Every hive role is **{{SAFE_CAPABILITY_CLASS e.g. web-read + propose-only}}**.
No blueprint role can {{DANGEROUS_ACTIONS e.g. add to a cart, check out, read
the card vault, or mutate approvals/purchases}} — enforced at install via role
capability envelopes (the oddsmith `ops-guard` pattern).

## Seam contract

- `payload.in` — `{{INPUT_TYPE}} { {{INPUT_FIELDS}} }` (your contracts
  package); the app enqueues it per {{ENQUEUE_TRIGGER}}.
- `payload.out` — `{{CONTRACT_NAME}} [{ {{OUTPUT_FIELDS}} }]`; the member
  completes the work_item with it; the sidecar ingests it into
  `{{APP_TABLE}}` through ONE parse gate (`parse{{CONTRACT_NAME}}`) — the only
  path from agent output to an app table.
