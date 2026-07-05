/**
 * Reference template manifests — the retro-fitted proof that the
 * template.yaml schema + composition semantics describe REALITY
 * (plan app-templates-2026-07-04 P-005 + P-014).
 *
 * P-014's recommended realization (owner directive: one app = a composition
 * of MANY templates) splits template #1 three ways, extracted from what
 * quartermaster actually is (oddsmith is the second reference instance):
 *
 *   - PAPERCUSP_OPS_HIVES_TEMPLATE   (aspect) — the 2-hive ops construction:
 *     the judgment plane + the ONE seam. Carries both Tier B components.
 *   - TAURI_DESKTOP_SHELL_TEMPLATE   (aspect) — the app chassis: the
 *     deterministic plane's host stack + release pipeline.
 *   - AGENTIC_DESKTOP_APP_TEMPLATE   (app)    — a THIN pure composition (no
 *     own components; the P-014 schema rule allows this exactly for non-empty
 *     composesWith). P-022 re-layered it: it now requires the non-agentic
 *     DESKTOP_APP_TEMPLATE as its BASE app (which pulls the shell + data +
 *     UI closure) and layers PAPERCUSP_OPS_HIVES on top.
 *
 * These are DRAFTS of the shippable templates: P-006 writes the GUIDE.md +
 * starter blueprints + contract templates around them, P-007 makes checks/
 * real, and P-013 (consumer #1) re-materializes quartermaster's agentic plane
 * from them. The suite validates each standalone, as a set
 * (validateTemplateSet), composed (composeTemplates — the union-of-checks),
 * and against COMPONENT_CATALOG, so catalog drift breaks this file loudly
 * (the P-009 gym re-runs the same validation).
 */
import type { TemplateManifest } from "./template-manifest.js";

/** Aspect: the 2-hive ops construction — the judgment plane + the ONE seam. */
export const PAPERCUSP_OPS_HIVES_TEMPLATE: TemplateManifest = {
  id: "papercusp-ops-hives",
  version: "0.1.0",
  scope: "aspect",
  category: "agentic",
  summary:
    "The judgment plane quartermaster and oddsmith instantiate: a domain hive + an -ops hive over it " +
    "(the Queen surveying a backlog and placing member harnesses), crossing into the app at exactly ONE " +
    "seam — work_items of a declared kind go up, a typed contract comes down through a single parse gate " +
    "into an app table. Nothing else crosses; confinement is enforced at install and the app's " +
    "blueprints/README.md states the rule.",
  components: [
    { id: "hive-app-seam", version: "0.1.0" },
    { id: "typed-contracts", version: "0.0.1" },
  ],
  // Starter blueprints (P-006): ops-hive extends work, member extends
  // research — placeholder lexicon, renamed per the domain at composition.
  blueprints: ["ops-hive", "member"],
  // The CandidateSet analog — the typed down-leg contract template the
  // building agent specializes for its domain.
  contracts: ["candidate-set"],
  decisionPoints: [
    { id: "seam-work-item-kind", prompt: "What work_item kind crosses the seam (quartermaster: purchase-research; oddsmith: bet-analysis)?" },
    { id: "contract-shape", prompt: "What does the down-leg contract carry (specialize the candidate-set template; one parse gate, rejects emitted as events)?" },
    { id: "domain-lexicon", prompt: "What are the domain nouns/verbs for hives, roles, and work (replaces the placeholder lexicon in the starter blueprints)?" },
    { id: "domain-roles", prompt: "Which member roles does the domain hive place, and with what capability envelopes (confinement rule stays inviolable)?" },
    { id: "app-tables", prompt: "Which app tables does ingested contract output land in, and what is the app-plane read model over them?" },
  ],
  composesWith: ["tauri-desktop-shell", "agentic-desktop-app"],
  docs: ["agent-insights/templates-system-design", "agent-insights/templates-template-yaml", "agent-insights/templates-component-catalog"],
  checks: [
    { id: "confinement-guard", run: "checks/confinement-guard.test.ts", summary: "no hive role holds cart/checkout/vault/approvals-write-analog capabilities" },
    { id: "seam-round-trip", run: "checks/seam-round-trip.test.ts", summary: "enqueue → complete with payload → contract parse gate ingests → app table row exists" },
    { id: "gym-signals", run: "checks/gym-signals.test.ts", summary: "the hive's guardrail gym signals are present and wired" },
  ],
};

/** Aspect: the app chassis — the deterministic plane's host stack + release pipeline. */
export const TAURI_DESKTOP_SHELL_TEMPLATE: TemplateManifest = {
  id: "tauri-desktop-shell",
  version: "0.1.0",
  scope: "aspect",
  category: "shell",
  summary:
    "The deterministic app chassis: a thin Tauri 2 shell (a HOST, not the app) spawning a Node/Hono " +
    "sidecar that serves the SPA + /api on a free localhost port, embedded Postgres with migrations on " +
    "boot and discovery-file connection resolution, operator.json for shell/CLI discovery, graceful " +
    "SIGTERM shutdown, and the tauri-release-kit build/release pipeline. Plain TypeScript packages — " +
    "Tier A throughout: compose and modify freely.",
  components: [
    { id: "tauri-shell", version: "0.0.1" },
    { id: "hono-host", version: "0.0.1" },
    { id: "embedded-postgres-server", version: "0.0.1" },
    { id: "tauri-release-kit", version: "0.1.0" },
  ],
  contracts: [],
  decisionPoints: [
    { id: "ui-shape", prompt: "What SPA surface does the deterministic plane need (grids, approvals view, streams)? FREE tier — compose as judged best." },
    { id: "app-identity", prompt: "App name, bundle identifier, app-home directory, and release channels (feeds tauri.conf + tauri-release-kit config)." },
  ],
  composesWith: ["papercusp-ops-hives", "agentic-desktop-app"],
  docs: ["agent-insights/templates-system-design", "agent-insights/templates-template-yaml", "agent-insights/templates-component-catalog"],
  checks: [
    { id: "boot-e2e", run: "checks/boot-e2e.test.ts", summary: "composed app builds, sidecar spawns, discovery file written, health returns 200" },
  ],
};

/**
 * App: template #1 — a THIN pure composition (no own components; P-014 allows
 * this exactly for non-empty composesWith). P-022 (owner #5): the agentic app
 * is a LAYER — it requires the non-agentic 'desktop-app' as its BASE app
 * (whose closure brings tauri-desktop-shell + papercusp-data-layer +
 * papercusp-ui) and adds papercusp-ops-hives, the judgment plane, on top.
 */
export const AGENTIC_DESKTOP_APP_TEMPLATE: TemplateManifest = {
  id: "agentic-desktop-app",
  version: "0.1.0",
  scope: "app",
  category: "app",
  summary:
    "The two-plane agentic desktop app quartermaster and oddsmith instantiate: papercusp-ops-hives " +
    "(judgment plane + the ONE seam) layered onto the non-agentic desktop-app BASE template — whose " +
    "requires-closure brings the tauri-desktop-shell chassis, papercusp-data-layer, and papercusp-ui — " +
    "plus glue guidance. An app built from this composition must pass the UNION of the full closure's " +
    "checks — that additive rule is what keeps free-form composition safe without a deterministic composer.",
  components: [],
  contracts: [],
  decisionPoints: [
    { id: "domain", prompt: "What is the app's domain — the noun the deterministic plane ledgers and the judgment plane reasons about? Drives every aspect-level decision point." },
  ],
  composesWith: ["desktop-app", "papercusp-ops-hives"],
  // P-015: requires is the HARD pinned edge. P-022 re-layered it: desktop-app
  // is the required BASE app (a base app joins the composition without owning
  // it — composeTemplates' root-app rule) and pulls the whole chassis + data
  // + UI closure; papercusp-ops-hives adds the judgment plane.
  requires: [
    { id: "desktop-app", version: "0.1.0" },
    { id: "papercusp-ops-hives", version: "0.1.0" },
  ],
  docs: ["agent-insights/templates-system-design", "agent-insights/templates-template-yaml"],
  checks: [
    { id: "composition-integrity", run: "checks/composition-integrity.test.ts", summary: "the composed set resolves (composeTemplates ok: pins consistent, one root app scope) and the union of checks is what CI runs" },
  ],
};

/**
 * Aspect: the live data-sync plane (owner directive 2026-07-04 / P-017 —
 * 'Papercusp Official: Data Sync'). Integrates the sync generic-library
 * family: client transports + SSE server primitives + event-maintained
 * projections + burst control + resumable large-asset transfer.
 */
export const PAPERCUSP_DATA_SYNC_TEMPLATE: TemplateManifest = {
  id: "papercusp-data-sync",
  version: "0.1.0",
  scope: "aspect",
  category: "data",
  summary:
    "The live data-sync plane for a papercusp-composed app: @papercusp/sync (client transports with " +
    "reconnect/backpressure) paired with @papercusp/sse (server SSE primitives + PG NOTIFY bridge), " +
    "@papercusp/projection-index for event-maintained read models, @papercusp/debounce-coalesce for " +
    "wake-floor + burst-coalesce delivery, and @papercusp/resumable-download for interrupted large-asset " +
    "transfer. Compose into any app whose UI must track server state live without polling.",
  components: [
    { id: "sync", version: "0.0.1" },
    { id: "sse", version: "0.0.1" },
    { id: "projection-index", version: "0.1.0" },
    { id: "debounce-coalesce", version: "0.1.0" },
    { id: "resumable-download", version: "0.1.0" },
  ],
  contracts: [],
  decisionPoints: [
    { id: "sync-transport", prompt: "Which sync transport fits the app — SSE (simplest, one-directional server push over the sidecar) or Zero (bidirectional)? Default SSE unless the app needs client-originated sync." },
    { id: "synced-surfaces", prompt: "Which app tables/views must sync live to the UI, and which stay request/response? Wire the PG NOTIFY bridge only for the live set." },
    { id: "projection-set", prompt: "Which derived read models does the UI query (feed projection-index from the change stream), and what burst policy per subscriber (wake floor / coalesce window via debounce-coalesce)?" },
    { id: "large-assets", prompt: "Does the app move large files (models, media, archives)? If so, route them through resumable-download with streaming checksums; if not, drop the component from the composition." },
  ],
  composesWith: ["tauri-desktop-shell", "papercusp-search", "papercusp-data-layer"],
  docs: ["agent-insights/templates-system-design", "agent-insights/templates-template-yaml", "agent-insights/templates-component-catalog"],
  checks: [
    { id: "components-integrated", run: "checks/components-integrated.test.ts", summary: "every pinned component package is a declared dependency of the composed app (config section: components)" },
  ],
};

/**
 * Aspect: the search plane (owner directive 2026-07-04 / P-018 —
 * 'Papercusp Official: Search'). Integrates the search generic-library
 * family: BM25 + pgvector hybrid retrieval over the app's own Postgres,
 * rank fusion, cross-encoder reranking, and the engine-agnostic relevance
 * core (steering / rewrite / eval contract).
 */
export const PAPERCUSP_SEARCH_TEMPLATE: TemplateManifest = {
  id: "papercusp-search",
  version: "0.1.0",
  scope: "aspect",
  category: "search",
  summary:
    "The search plane for a papercusp-composed app: @papercusp/search (host-agnostic BM25 + pgvector hybrid " +
    "retrieval over Postgres via pluggable SearchSources) fused by @papercusp/rrf, with @papercusp/rerank " +
    "(engine-agnostic cross-encoder precision pass) and @papercusp/search-core (rerank steering, LLM " +
    "category-match, query rewrite, and the shared eval-harness metric contract) layered on when relevance " +
    "quality matters. Compose into any app whose data users need to find by meaning, not just by filter.",
  components: [
    { id: "search", version: "0.1.0" },
    { id: "search-core", version: "0.1.0" },
    { id: "rerank", version: "0.1.0" },
    { id: "rrf", version: "0.1.0" },
  ],
  contracts: [],
  decisionPoints: [
    { id: "search-surfaces", prompt: "Which app tables/entities are searchable? Each becomes a pluggable SearchSource owning its own tsvector/pgvector SQL — the engine composes them; it never guesses your schema." },
    { id: "retrieval-mode", prompt: "BM25-only or hybrid BM25+embeddings? Hybrid needs a query embedder injected (the lib carries no embedding provider). Default BM25-only until the app has an embedding pipeline; RRF fusion turns on with the second ranking." },
    { id: "relevance-stack", prompt: "Is raw retrieval enough, or does the app need the precision stack — cross-encoder reranking (@papercusp/rerank; needs a ZeroEntropy API key) plus search-core's steering/rewrite/category-match? Drop rerank + search-core from the composition when plain retrieval suffices." },
    { id: "relevance-evals", prompt: "What proves relevance for THIS domain — which golden queries and which metrics (search-core's shared eval-harness contract)? A search plane without an eval set degrades silently." },
  ],
  composesWith: ["tauri-desktop-shell", "papercusp-data-sync", "papercusp-data-layer"],
  docs: ["agent-insights/templates-system-design", "agent-insights/templates-template-yaml", "agent-insights/templates-component-catalog"],
  checks: [
    { id: "components-integrated", run: "checks/components-integrated.test.ts", summary: "every pinned component package is a declared dependency of the composed app (config section: components)" },
  ],
};

/**
 * Aspect: the app-owned data plane (owner directive 2026-07-04 / P-019 —
 * 'Papercusp Official: Embedded Data Layer'). embedded-postgres-server
 * (pattern) + @papercusp/embedded-pg-discovery + typed-contracts (pattern):
 * an embedded Postgres that boots with the app, generic connection
 * resolution, and the single-parse-gate write discipline.
 */
export const PAPERCUSP_DATA_LAYER_TEMPLATE: TemplateManifest = {
  id: "papercusp-data-layer",
  version: "0.1.0",
  scope: "aspect",
  category: "data",
  summary:
    "The embedded data layer for a papercusp-composed app: the embedded-postgres-server pattern (an app-owned " +
    "Postgres booted with the app — lifecycle, migrations on boot, per-boot port, discovery file), " +
    "@papercusp/embedded-pg-discovery for connection resolution (env vars → discovery file → fallback), and " +
    "the typed-contracts pattern — a single parse gate for every write that crosses a trust boundary into app " +
    "tables. Compose into any app that owns its data instead of depending on external infrastructure.",
  components: [
    { id: "embedded-postgres-server", version: "0.0.1" },
    { id: "embedded-pg-discovery", version: "0.1.0" },
    { id: "typed-contracts", version: "0.0.1" },
  ],
  contracts: [],
  decisionPoints: [
    { id: "app-schema", prompt: "Which tables does the app own, and what is the migration story? Migrations run forward-only on boot (the embedded-postgres-server pattern) — there is no ops window in a desktop app." },
    { id: "connection-resolution", prompt: "Parameterize @papercusp/embedded-pg-discovery for THIS app: which env vars (in priority order), which discovery-file path under the app home, which fallback URL? Never hardcode the port — it rotates per boot." },
    { id: "contract-gates", prompt: "Which writes cross a trust boundary (agent output, imported files, network payloads)? Each gets the typed-contracts discipline — a dedicated contracts package + ONE parse gate, rejects surfaced as events. If the app composes papercusp-ops-hives this is MANDATORY for the seam; if nothing untrusted writes, drop the pattern." },
  ],
  composesWith: ["tauri-desktop-shell", "papercusp-data-sync", "papercusp-search"],
  docs: ["agent-insights/templates-system-design", "agent-insights/templates-template-yaml", "agent-insights/templates-component-catalog"],
  checks: [
    { id: "components-integrated", run: "checks/components-integrated.test.ts", summary: "every pinned component package is a declared dependency of the composed app (config section: components)" },
  ],
};

/**
 * Aspect: the UI kit (owner directive 2026-07-04 / P-020 —
 * 'Papercusp Official: UI Kit'). Integrates the UI generic-library family:
 * headless React primitives, the papergrid data-grid stack, the dockview
 * workbench shell, and brand-lexicon terminology resolution.
 */
export const PAPERCUSP_UI_TEMPLATE: TemplateManifest = {
  id: "papercusp-ui",
  version: "0.1.0",
  scope: "aspect",
  category: "ui",
  summary:
    "The UI kit for a papercusp-composed app: @papercusp/ui-primitives (headless ANSI/terminal, markdown, " +
    "JSON-tree, and virtualized-list primitives — brand-value-free, consumer-styled), the papergrid data-grid " +
    "stack (grid-core sort/selection/virtualization + bloom-grid server-rendered rows), " +
    "@papercusp/dock-workbench (host-agnostic dockview panel workbench with pluggable layout persistence), and " +
    "@papercusp/lexicon (canonical term keys → brand-pack display labels, so rebranding is a pack swap). " +
    "Compose into any app whose deterministic plane needs an operator-style SPA.",
  components: [
    { id: "ui-primitives", version: "0.0.1" },
    { id: "papergrid", version: "0.1.0" },
    { id: "dock-workbench", version: "0.0.1" },
    { id: "lexicon", version: "0.1.0" },
  ],
  contracts: [],
  decisionPoints: [
    { id: "ui-surfaces", prompt: "Which surfaces does the app's deterministic plane need — data grids, terminal/agent-output panes, markdown/docs views, JSON inspectors, a multi-panel workbench? Take only the components those surfaces use; drop the rest from the composition." },
    { id: "grid-usage", prompt: "papergrid is a META-PACKAGE — apps depend on the grid SUB-PACKAGES directly (@papercusp/grid-core, @papercusp/bloom-grid, @papercusp/grid). Which grids does the app need, and do any need server-rendered rows (bloom-grid) vs pure client virtualization (grid-core)?" },
    { id: "workbench-layout", prompt: "What is the panel layout — which panels register in the dock-workbench registry, what is the default logical layout, and where does layout persistence live (the app's data layer vs localStorage)?" },
    { id: "branding-lexicon", prompt: "Which brand pack names the app's nouns? Register the domain's term keys with @papercusp/lexicon, wire the configure*() host seam to the app's pack selection, and route EVERY user-facing noun through it — never hardcode a display label a rebrand would have to grep for." },
  ],
  composesWith: ["tauri-desktop-shell", "papercusp-data-sync"],
  docs: ["agent-insights/templates-system-design", "agent-insights/templates-template-yaml", "agent-insights/templates-component-catalog"],
  checks: [
    { id: "components-integrated", run: "checks/components-integrated.test.ts", summary: "every pinned component package is a declared dependency of the composed app (config section: components)" },
  ],
};

/**
 * App: the non-agentic whole-app template (owner directive 2026-07-04 #4 /
 * P-021 — 'Papercusp Official: Desktop App'). A THIN pure composition
 * pulling the chassis + data + UI closure via hard requires; the agentic app
 * template re-layers onto this (owner #5 / P-022).
 */
export const DESKTOP_APP_TEMPLATE: TemplateManifest = {
  id: "desktop-app",
  version: "0.1.0",
  scope: "app",
  category: "app",
  summary:
    "A whole papercusp-style desktop app with NO agent orchestration: the tauri-desktop-shell chassis (thin " +
    "Tauri host → Node/Hono sidecar → release pipeline) + papercusp-data-layer (app-owned embedded Postgres, " +
    "connection discovery, typed-contract write gates) + papercusp-ui (headless primitives, data grids, dock " +
    "workbench, brand lexicon), pulled in as hard requires. A thin pure composition — no own components; an " +
    "app built from it must pass the UNION of the closure's checks. Need agents? Use agentic-desktop-app, " +
    "which layers the judgment plane on top of this.",
  components: [],
  contracts: [],
  decisionPoints: [
    { id: "domain", prompt: "What is the app's domain — the noun its data layer ledgers and its UI surfaces? Drives every aspect-level decision point (schema, searchable surfaces, panels, lexicon terms)." },
    { id: "optional-planes", prompt: "Beyond the required closure, does the app need live UI state sync (compose papercusp-data-sync) or search over its data (compose papercusp-search)? Add them to the composition now if so — both are designed to drop onto this chassis." },
  ],
  composesWith: ["tauri-desktop-shell", "papercusp-data-layer", "papercusp-ui", "papercusp-data-sync", "papercusp-search"],
  // P-015: HARD pinned deps — composing/installing this app template pulls
  // the whole chassis+data+ui closure in; the checks union covers the closure.
  requires: [
    { id: "tauri-desktop-shell", version: "0.1.0" },
    { id: "papercusp-data-layer", version: "0.1.0" },
    { id: "papercusp-ui", version: "0.1.0" },
  ],
  docs: ["agent-insights/templates-system-design", "agent-insights/templates-template-yaml"],
  checks: [
    { id: "composition-integrity", run: "checks/composition-integrity.test.ts", summary: "the composed set resolves (composeTemplates ok: pins consistent, one root app scope) and the union of checks is what CI runs" },
  ],
};

/**
 * Aspect: the desktop release plane (owner directive 2026-07-04 / P-023 —
 * 'Papercusp Official: Release Pipeline'). tauri-release-kit as a composable
 * aspect: the kit owns the release DANCE; the app injects ONLY buildSidecar()
 * + a TauriReleaseConfig. Same 0.1.0 pin the shell template carries —
 * composing both stays pin-consistent.
 */
export const RELEASE_PIPELINE_TEMPLATE: TemplateManifest = {
  id: "release-pipeline",
  version: "0.1.0",
  scope: "aspect",
  category: "release",
  summary:
    "The desktop release plane: @papercusp/tauri-release-kit — provider-agnostic build+release orchestration " +
    "(version bump across versionFiles, channel→tag resolution, tauri build target matrix, artifact " +
    "classification, latest.json updater-manifest generation, gh release upload, Mac/Windows VM drivers over " +
    "an SSH frame) with the app-specific sidecar build injected via the buildSidecar() seam and all side " +
    "effects behind Exec/Fs/Log ports. The shell template already pins the kit; THIS aspect is the deepened " +
    "release guidance — channels, signing, updater feed, target matrix — for apps that ship for real.",
  components: [{ id: "tauri-release-kit", version: "0.1.0" }],
  contracts: [],
  decisionPoints: [
    { id: "release-channels", prompt: "Which release channels does the app ship (stable only? stable+beta?) and what tag scheme names them? The kit's channel→tag resolution (defaultTagFor) encodes the answer; every channel needs its own updater feed URL." },
    { id: "release-targets", prompt: "What is the target matrix — linux-x86_64 (deb/AppImage) built locally, mac universal (dmg) and windows (msi/nsis) on VMs over the kit's SSH frame? Which targets are release-blocking vs best-effort?" },
    { id: "signing-and-updater", prompt: "Where does the Tauri signing key live (keyPath + passwordEnv — the key and password are NEVER committed; keychain/keyfile per platform), and where do updater manifests point (latestJsonUrl — usually the gh release asset URL)? A desktop app without signing/updater wiring is a prototype." },
    { id: "sidecar-build", prompt: "What does buildSidecar(ctx) do for THIS app — the ONE injected seam (papercusp: a ~1,070-line bundler; oddsmith: ~42 lines of esbuild)? Keep it a pure function of the repo tree; everything else is the kit's." },
  ],
  composesWith: ["tauri-desktop-shell", "desktop-app", "agentic-desktop-app"],
  docs: [
    "agent-insights/templates-system-design",
    "agent-insights/templates-template-yaml",
    "agent-insights/templates-component-catalog",
    "build-system/tauri-release-kit-proposal",
  ],
  checks: [
    { id: "components-integrated", run: "checks/components-integrated.test.ts", summary: "every pinned component package is a declared dependency of the composed app (config section: components)" },
  ],
};

/**
 * Aspect: the web app chassis (owner directive 2026-07-05 / P-029 — extracted
 * from the Restart webapp audit, agent-insights/
 * restart-webapp-audit-papercusp-webapp-template). The web twin of
 * tauri-desktop-shell: the HOST is config/skeleton (a pattern component),
 * not a lib — the heavy web stack (UI kit, sync, search) already lives in
 * the sibling aspect templates.
 */
export const PAPERCUSP_WEB_HOST_TEMPLATE: TemplateManifest = {
  id: "papercusp-web-host",
  version: "0.1.0",
  scope: "aspect",
  category: "shell",
  summary:
    "The web app chassis — the web twin of tauri-desktop-shell, extracted from the Restart webapp (the first " +
    "papercusp project): a Next.js app-router host built with output:'standalone' (outputFileTracingRoot at " +
    "the monorepo root + transpilePackages for every workspace lib — the classic monorepo miss), started as " +
    "node server.js with static/public assets staged in, operator.json discovery written on boot, an auth " +
    "seam (middleware.ts gate stub + a minimal basic-auth reverse proxy — placeholders to REPLACE before real " +
    "exposure), a Dockerfile builder on the workspace-manifest COPY layer, and a serial-PG vitest rig. " +
    "Config/skeleton, not a lib — Tier A throughout: compose and modify freely.",
  components: [{ id: "next-standalone-host", version: "0.0.1" }],
  contracts: [],
  decisionPoints: [
    {
      id: "hosting-target",
      prompt:
        "Where does the app run — a local per-user install (papercusp-style), a container (the Dockerfile " +
        "builder pattern), or behind a reverse proxy on a server? Drives PORT/HOSTNAME wiring, the update " +
        "story, and whether the basic-auth proxy is even relevant.",
    },
    {
      id: "auth-strategy",
      prompt:
        "What replaces the auth placeholders before exposure? The template ships a middleware.ts gate STUB " +
        "and a basic-auth reverse proxy for pre-release protection — shipping either as the real auth is the " +
        "classic miss; pick the app's real authn/z at composition time.",
    },
    {
      id: "render-strategy",
      prompt:
        "Which routes are SSR/server-components vs client-only? The standalone output serves both; decide " +
        "per surface — data-heavy operator-style panes usually go client + live sync, content/docs surfaces " +
        "go server.",
    },
    {
      id: "observability",
      prompt:
        "Does the app wire instrumentation.ts (OTEL) and browser RUM, or ship without? FREE tier — a " +
        "deployed multi-user webapp without traces debugs blind; a local single-user install can skip it.",
    },
  ],
  composesWith: ["papercusp-data-layer", "papercusp-ui", "papercusp-data-sync", "papercusp-search", "papercusp-webapp"],
  docs: [
    "agent-insights/templates-system-design",
    "agent-insights/templates-template-yaml",
    "agent-insights/templates-component-catalog",
    "agent-insights/restart-webapp-audit-papercusp-webapp-template",
  ],
  checks: [
    { id: "boot-e2e", run: "checks/boot-e2e.test.ts", summary: "composed web app builds, host starts, discovery file written, health returns 200" },
  ],
};

/**
 * App: the non-agentic whole-WEB-app template (owner directive 2026-07-05 /
 * P-030 — 'Papercusp Official: Web App'). What desktop-app is to the desktop
 * this is to the browser: a THIN pure composition swapping the tauri chassis
 * for papercusp-web-host; data + UI closure identical.
 */
export const PAPERCUSP_WEBAPP_TEMPLATE: TemplateManifest = {
  id: "papercusp-webapp",
  version: "0.1.0",
  scope: "app",
  category: "app",
  summary:
    "A whole papercusp-style WEB app — what desktop-app is to the desktop, this is to the browser (extracted " +
    "from the Restart webapp, the first papercusp project): the papercusp-web-host chassis (Next.js " +
    "standalone host, auth seam, deploy skeleton) + papercusp-data-layer (app-owned Postgres, connection " +
    "discovery, typed-contract write gates) + papercusp-ui (headless primitives, data grids, dock workbench, " +
    "brand lexicon), pulled in as hard requires. A thin pure composition — no own components; an app built " +
    "from it must pass the UNION of the closure's checks. No agent plane here; an agentic web app layers " +
    "papercusp-ops-hives onto this the way agentic-desktop-app layers onto desktop-app.",
  components: [],
  contracts: [],
  decisionPoints: [
    {
      id: "domain",
      prompt:
        "What is the app's domain — the noun its data layer ledgers and its UI surfaces? Drives every " +
        "aspect-level decision point (schema, searchable surfaces, panels, lexicon terms).",
    },
    {
      id: "tenancy",
      prompt:
        "Single-user local install (papercusp-style, embedded PG per install) or multi-user server " +
        "deployment (one PG, real auth, sessions)? The web chassis serves both, but auth-strategy, data-layer " +
        "connection resolution, and the hosting target all fork on this answer — decide it FIRST.",
    },
    {
      id: "optional-planes",
      prompt:
        "Beyond the required closure, does the app need live UI state sync (compose papercusp-data-sync) or " +
        "search over its data (compose papercusp-search)? Add them to the composition now if so — both are " +
        "designed to drop onto this chassis.",
    },
  ],
  composesWith: ["papercusp-web-host", "papercusp-data-layer", "papercusp-ui", "papercusp-data-sync", "papercusp-search"],
  // P-015: HARD pinned deps — composing/installing this app template pulls
  // the web chassis + data + UI closure in; the checks union covers the closure.
  requires: [
    { id: "papercusp-web-host", version: "0.1.0" },
    { id: "papercusp-data-layer", version: "0.1.0" },
    { id: "papercusp-ui", version: "0.1.0" },
  ],
  docs: [
    "agent-insights/templates-system-design",
    "agent-insights/templates-template-yaml",
    "agent-insights/restart-webapp-audit-papercusp-webapp-template",
  ],
  checks: [
    { id: "composition-integrity", run: "checks/composition-integrity.test.ts", summary: "the composed set resolves (composeTemplates ok: pins consistent, one root app scope) and the union of checks is what CI runs" },
  ],
};

/** The reference template set — validateTemplateSet(REFERENCE_TEMPLATES) must stay green. */
export const REFERENCE_TEMPLATES: TemplateManifest[] = [
  PAPERCUSP_OPS_HIVES_TEMPLATE,
  TAURI_DESKTOP_SHELL_TEMPLATE,
  AGENTIC_DESKTOP_APP_TEMPLATE,
  PAPERCUSP_DATA_SYNC_TEMPLATE,
  PAPERCUSP_SEARCH_TEMPLATE,
  PAPERCUSP_DATA_LAYER_TEMPLATE,
  PAPERCUSP_UI_TEMPLATE,
  DESKTOP_APP_TEMPLATE,
  RELEASE_PIPELINE_TEMPLATE,
  PAPERCUSP_WEB_HOST_TEMPLATE,
  PAPERCUSP_WEBAPP_TEMPLATE,
];
