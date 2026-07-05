# Templates

Distributable units an agent composes into an app (or an app-aspect) on
papercusp: **components** (version-pinned refs into the
[component catalog](../libs/generic/template-kit/src/catalog.ts)) +
**guidance** (`GUIDE.md`, the composition prompt) + **checks** (the acceptance
suite any composition must pass). Correctness by **verification, not
construction** — the design of record is
`apps/operator-docs … agent-insights/templates-system-design`
(served at `/internal/docs/agent-insights/templates-system-design`).

## Source of truth (v1 — plan app-templates-2026-07-04 P-006/D-005)

- **This directory is the v1 template source of truth**: versioned with the
  repo, git-synced, readable by the anti-rot gym (P-009). The Cupboard/Comb
  Templates section (P-010) *projects* from here.
- **Manifests are pinned by test**: `@papercusp/template-kit`
  `src/reference-templates.ts` is the machine form; the kit's suite asserts
  each `templates/<id>/template.yaml` here parses, validates, and matches it.
  Edit BOTH sides (yaml + reference manifest) — a mismatch fails the kit's
  tests loudly.
- Schema: `agent-insights/templates-template-yaml`
  (validator: `@papercusp/template-kit` `parseTemplateManifest`).

## The set (the official expansion — Phase 5, owner directive 2026-07-04)

| Template | Scope | Category | What |
|---|---|---|---|
| [`papercusp-desktop-app`](papercusp-desktop-app/) | app | app | a WHOLE desktop app, no agents — hard-requires the shell + data-layer + ui closure; start here for a plain app |
| [`papercusp-webapp`](papercusp-webapp/) | app | app | a WHOLE web app, no agents — the browser twin of `papercusp-desktop-app`: hard-requires the web-host + data-layer + ui closure (P-030; extracted from the first papercusp webapp) |
| [`papercusp-agentic-desktop-app`](papercusp-agentic-desktop-app/) | app | app | the app WITH agents: `papercusp-ops-hives` layered onto the `papercusp-desktop-app` BASE (P-022 — an app template may require another as its base) |
| [`papercusp-ops-hives`](papercusp-ops-hives/) | aspect | agentic | the judgment plane: domain hive + -ops hive + the ONE work_items⇄contract seam |
| [`papercusp-tauri-desktop-shell`](papercusp-tauri-desktop-shell/) | aspect | shell | the deterministic chassis: Tauri shell → Node/Hono sidecar → embedded Postgres + release kit |
| [`papercusp-web-host`](papercusp-web-host/) | aspect | shell | the web chassis: Next.js standalone host (tracing root + workspace transpile), operator.json discovery, auth seam, Dockerfile builder (P-029) |
| [`papercusp-data-layer`](papercusp-data-layer/) | aspect | data | app-owned embedded Postgres + connection discovery + typed-contract write gates |
| [`papercusp-data-sync`](papercusp-data-sync/) | aspect | data | live UI state sync: client transports + SSE server + event-maintained projections |
| [`papercusp-search`](papercusp-search/) | aspect | search | search over app data: sources + hybrid retrieval + rerank + RRF fusion |
| [`papercusp-ui`](papercusp-ui/) | aspect | ui | the operator-style SPA kit: headless primitives, papergrid, dock-workbench, lexicon |
| [`papercusp-release-pipeline`](papercusp-release-pipeline/) | aspect | release | tauri-release-kit as an aspect: channels, signing, updater feed, target matrix (P-023) |

An app built from N templates must pass the **union of their checks**
(`composeTemplates` — see the schema doc §Composition semantics). An app-scope
template may `require` another app-scope template as its BASE; every
composition has exactly ONE ROOT app (the one no other app requires).

## Running the checks (landed: P-007)

The `<id>/checks/*.test.ts` files are PORTABLE template content — copied
verbatim into a composed app and parameterized via a JSON config named by the
**`TEMPLATE_CHECKS_CONFIG`** env var (schema: `@papercusp/template-kit`
`TemplateChecksConfig`). Unconfigured they SKIP. This directory is also the
`@papercusp/templates` workspace member, so in-repo:

```sh
npm test -w @papercusp/templates                 # composition-integrity green, rest skip
TEMPLATE_CHECKS_CONFIG=<config> npm test -w @papercusp/templates   # the full union
```

Worked example config:
[`papercusp-agentic-desktop-app/reference/worked-example.checks-config.json`](papercusp-agentic-desktop-app/reference/worked-example.checks-config.json).
Per-check contracts: each template's `checks/README.md`.

## The template gym (landed: P-009)

Anti-rot cadence (D-007: *the template is tested by building an app from it*):
the `template-gym` system routine (`system:template-gym`, every 6h) re-verifies
five legs — the P-013 verbatim-materialization invariant (`<id>/checks/*.test.ts`
⇄ consumer #1's `packages/template-checks/`, byte-identical;
`composition-integrity` is declared repo-side-only), docs⇄catalog drift
(`COMPONENT_CATALOG` ids ⊆ the published catalog page), the template-kit drift
pins, this workspace's suite, and consumer #1's configured union inside the
consumer-#1 repo. A standing RED auto-files ONE `template-drift` work-item
(stable watchdogKey `template-gym:<leg>`); the gym is advisory and never gates.

Code: `packages/operator-core/lib/harness/routines/template-gym-{runner,action}.ts`
(+ `seed-template-gym-routine.ts`). On-demand run + per-leg re-run:

```sh
npx tsx packages/operator-core/lib/harness/routines/template-gym-runner.ts \
  [--legs materialization,docs-catalog,kit-suite,template-suite,app-checks] \
  [--qm-root <consumer-1 clone>]           # default: the sibling clone
```

Run history: `~/.papercusp/template-gym/` (`last-run.json` + `runs.jsonl`).

## Cupboard distribution (landed: P-010)

Each template here is publishable as a **`kind=template` Cupboard listing**
(repo-backed: the listing points at this dir via `listing_ref = <id>`; nothing
is flattened or copied at publish time). The loop:

- **Publish**: the `template:publish` agent tool (title ≤200 / description
  ≤280 — worker caps). D-007 review policy: a template carries GUIDE.md — an
  instruction-carrying artifact — so listings land **pending** and are publicly
  invisible until operator approval. The official set uses
  **"Papercusp Official:"** title prefixes.
- **Public mirror (REQUIRED)**: the worker rejects listings on private repos
  (`private_repo_rejected` — a listing users can't clone is broken), and this
  monorepo is private. Official listings therefore publish from the PUBLIC
  mirror **[Papercusp/templates](https://github.com/Papercusp/templates)** —
  a copy of these `<id>/` dirs (this tree stays canonical; push changed dirs
  to the mirror before re-publishing). Mirror-sync automation is a tracked
  follow-up (P-027).
## Supply chain — building OUTSIDE papercup (v1, WI-2860..2863 + WI-2891)

A builder cloning only the public mirror gets everything it needs to compose
an app and run the checks union — the round-1 greenfield build proved the
template DESIGN holds but surfaced four distribution gaps; this is the
official v1 mechanism that closes them:

- **`@papercusp/template-kit`** is VENDORED in the mirror as `template-kit/`
  (source-shippable: zero runtime deps, `main: ./src/index.ts`). Consume it
  with a `file:` dependency — the mirror's root `package.json` already wires
  `"@papercusp/template-kit": "file:./template-kit"`, so
  `composition-integrity` runs after a plain `npm install`. The kit is NOT
  on npm; this monorepo (`libs/generic/template-kit/`) stays canonical and
  the vendored copy rides the mirror sync (below).
- **`@papercusp/hive-app-seam`** — the papercusp-ops-hives Tier-B MUST
  component — is vendored the same way as `hive-app-seam/` (WI-2891: the
  round-3 build proved the catalog's source repo is not reachable from
  outside papercusp, so the seam MUST ride the mirror). Zero runtime deps,
  `main: ./src/index.ts`; the mirror root `package.json` wires
  `"@papercusp/hive-app-seam": "file:./hive-app-seam"`, and an app repo
  links it as
  `"@papercusp/hive-app-seam": "file:../<mirror-clone>/hive-app-seam"`.
  Canonical: `libs/generic/hive-app-seam` in the monorepo.
- **Mirror sync is guarded** (P-027): the canonical monorepo carries
  `scripts/templates-mirror-sync.mjs`, which diffs the canonical tree —
  every template dir, this README, and the vendored packages
  (`template-kit/`, `hive-app-seam/`) — against a local
  mirror clone. Check mode (`npm run mirror:check` in the monorepo's
  `templates/`) exits non-zero on ANY drift, and the publish tooling
  refuses to publish official listings while red; `--push`
  (`npm run mirror:push`) applies the sync and pushes the mirror. The
  published mirror therefore never silently trails the canonical tree.
- **Other component packages** (`@papercusp/sync`, `@papercusp/ui-primitives`,
  …) are not published to npm either and are NOT vendored (they have runtime
  deps or platform coupling the mirror can't carry). The official v1
  mechanism: `file:`-link
  them from a **local papercusp install** (`<install>/libs/generic/<pkg>`) —
  e.g. `"@papercusp/sync": "file:../papercusp/libs/generic/sync"`. A
  papercusp install is a prerequisite for building a papercusp app; the
  templates assume its `libs/generic/*` tree is reachable.
- **Runnable checks harness**: the mirror root carries `package.json` +
  `vitest.config.ts`, so `npm install && npm test` runs every
  `<id>/checks/*.test.ts` — `composition-integrity` green against the
  mirror's template set, the app-parameterized checks SKIP until your app
  sets `TEMPLATE_CHECKS_CONFIG`.
- **Worked exemplars are papercusp-internal** — the templates cite proven
  shapes, not repos to clone. The PORTABLE truth every builder can rely on
  is each template's `GUIDE.md` + `checks/` + the checked-in worked configs
  (e.g. `papercusp-agentic-desktop-app/reference/worked-example.checks-config.json`).

## Cupboard install

- **Install**: the Cupboard **Templates** tab (`?kind=template`) →
  `POST /api/cupboard/install-template` → shallow-clone + kit validation
  (schema + component-catalog pin check — a stale pin fails the install, same
  rule as the gym) → materialized under **`~/.papercusp/templates/<id>/`**,
  where the from-template scaffold entry (P-011) reads it.
- Worker side: D1 migration `010_template_kind.sql`;
  operator side: `operator-core/lib/cupboard/install-template-core.ts`.
