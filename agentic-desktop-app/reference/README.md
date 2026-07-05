# reference/ — worked examples

Pointers, not copies (the living repos are the truth). NOTE: the exemplar
repos below are PRIVATE — an external builder's clone 404s (WI-2863); the
PORTABLE truth is this template's `GUIDE.md` + `checks/` + the checked-in
worked configs:

- **quartermaster** — `github.com/Papercusp/quartermaster` (primary exemplar,
  and consumer #1 — RETROFITTED as-if-template-built, P-013):
  `blueprints/` (ops hive + member + confinement README),
  `packages/contracts` (CandidateSet + the parse gate),
  `apps/desktop` (`src-tauri/src/main.rs`, `bin/serve.ts`, `src/_hono/`),
  `libs/hive-app-seam` (consumes the extracted Tier B component),
  `packages/template-checks` (the materialized check suites + this config +
  the DECISIONS.md decision-point disclosure; `npm run template-checks`).
- **oddsmith** — the pattern's origin: `blueprints/`, `@oddsmith/contracts`,
  `apps/desktop`, `agent-insights/two-dispatch-models-queen-bee-vs-coding-factory`.
- **Docs**: `/internal/docs/agent-insights/templates-system-design` (design of
  record) · `templates-component-catalog` · `templates-template-yaml`.
