# reference/ — worked examples

What every builder can rely on, wherever this template was cloned from:

- **The starter blueprints in `../blueprints/`** — the ops-hive + member
  shapes ARE the worked reference: replace every `{{…}}` token while walking
  the template's decision points; the structure (one seam,
  capability-enveloped roles, gym signals) should survive your edits.
- **The contract template in `../contracts/`** — `candidate-set.ts`, the
  typed down-leg contract you specialize per domain.
- **Worked checks-config**:
  [`../../agentic-desktop-app/reference/worked-example.checks-config.json`](../../agentic-desktop-app/reference/worked-example.checks-config.json)
  — its `confinement`, `seam`, and `gym` sections configure this template's
  checks.
- **Your papercusp install** — the docs at `/internal/docs` (start with
  `agent-insights`, e.g. `two-dispatch-models-queen-bee-vs-coding-factory`)
  are the design record.
- **Docs**: `/internal/docs/agent-insights/templates-system-design` ·
  `templates-component-catalog` · `templates-template-yaml`.
