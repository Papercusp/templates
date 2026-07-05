# checks/ — the acceptance suite (landed: plan app-templates-2026-07-04 P-007)

## `composition-integrity` (`composition-integrity.test.ts`) — the set resolves

Validates the TEMPLATE SET (the composition plan), not the built app: every
`template.yaml` parses + matches the component catalog (no stale pins), the
set is coherent (unique ids, resolvable `composesWith`), and each app-scope
template + its `requires` closure + its `composesWith` affinity composes via
`@papercusp/template-kit` `composeTemplates` — pins consistent, exactly one
ROOT app scope (P-022: a required BASE app, e.g. desktop-app under THIS
template, joins the composition without owning it; a foreign app the root
does not require stays a separate composition), and the **full additive
union-of-checks** (`templateId:checkId`) survives. That union IS the app's
definition of done.

Runs wherever `@papercusp/template-kit` is available (it is NOT one of the
dependency-free portable checks):

- **In this repo, unconfigured** — against the sibling `templates/<id>/`
  dirs, as the `@papercusp/templates` workspace suite
  (`npm test -w @papercusp/templates`). The release gate pins it continuously.
- **Configured** — `TEMPLATE_CHECKS_CONFIG` section
  `composition.templateYamls` names a materialized app's CHOSEN set.

The union rule means a composed app must ALSO pass the closure's suites:
`confinement-guard` / `seam-round-trip` / `gym-signals`
(`../../papercusp-ops-hives/checks/`), `boot-e2e`
(`../../tauri-desktop-shell/checks/`), `components-integrated`
(`../../papercusp-data-layer/checks/`, `../../papercusp-ui/checks/`), and
the desktop-app base's own `composition-integrity`. Worked example config
for consumer #1:
[`../reference/worked-example.checks-config.json`](../reference/worked-example.checks-config.json).
