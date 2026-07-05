# papercusp-ui — composition GUIDE

**Papercusp Official: UI Kit.** This aspect template wires the UI
generic-library family into a composed app's deterministic plane: headless
React primitives, the data-grid stack, the dockview workbench shell, and
brand-lexicon terminology. Everything here is **Tier A** (plain libraries) —
compose and modify freely; the MUSTs are about wiring shape, not code
ownership.

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

Four legs; take only what the app's surfaces need:

1. **Primitives** — `@papercusp/ui-primitives`: headless ANSI/terminal
   output, markdown (GFM), a JSON tree viewer, and virtualized lists. Brand-
   value-free — styling is injected by the consumer, so they render under
   any design system. (Peer deps: react, react-markdown, react-virtuoso,
   anser, etc. — declare them in the app.)
2. **Grids** — the papergrid stack: `@papercusp/grid-core`
   (sort/selection/virtualization logic), `@papercusp/bloom-grid` (row store
   + server-rendered rows), `@papercusp/grid`. `@papercusp/papergrid` itself
   is a META-package — apps import the sub-packages directly.
3. **Workbench** — `@papercusp/dock-workbench`: a host-agnostic dockview
   shell — panel registry, logical layout schema + adapters, pluggable
   persistence, and the React `DockWorkspace`. The multi-panel chrome of an
   operator-style app.
4. **Lexicon** — `@papercusp/lexicon`: canonical term keys → display labels
   via the active brand pack (pure singular/plural/lowercase resolution + a
   `configure*()` seam for non-React callers).

## MUST

- Keep the primitives HEADLESS: style them from the app's design system —
  never fork a primitive to hardcode brand values into it.
- Depend on the grid SUB-PACKAGES directly (decision point `grid-usage`) —
  `@papercusp/papergrid` is the catalog handle, not the import.
- Route every user-facing noun through the lexicon (decision point
  `branding-lexicon`): resolve via term keys + the active pack; assert routed
  keys in tests, not literal strings. A hardcoded display label is a rebrand
  grep waiting to happen.
- Declare every component you keep (and the primitives' peer deps) as real
  dependencies — the `components-integrated` check fails a composition wired
  "on paper".

## SHOULD

- Feed live grids from the `papercusp-data-sync` template's plane (grid over
  a synced projection beats grid over a polled endpoint).
- Persist workbench layout in the app's own data layer (the
  `papercusp-data-layer` template) rather than browser storage when the app
  has one — layouts survive reinstalls with the app home.
- Serve the SPA from the sidecar host (`hono-host` in
  `tauri-desktop-shell`) — this kit is the SPA's inside, not a second host.

## FREE

- Which panels/grids/views exist, all styling and theming, layout defaults,
  which brand pack is active, and whether any leg is dropped entirely (an
  app with no tabular data needs no grid stack).

## Checks

`checks/components-integrated.test.ts` — configure the `components` section of
your `TEMPLATE_CHECKS_CONFIG` with the package names you kept. Unconfigured it
skips; see `checks/README.md`.
