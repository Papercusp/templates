# papercusp-desktop-app — check contracts

## `composition-integrity` (`composition-integrity.test.ts`) — the set resolves

Validates the TEMPLATE SET (the composition plan), not the built app: every
`template.yaml` parses + matches the component catalog (no stale pins), the
set is coherent (unique ids, resolvable `composesWith`), and each app-scope
template + its `requires` closure + its `composesWith` affinity composes via
`@papercusp/template-kit` `composeTemplates` — pins consistent, exactly one
ROOT app scope (P-022: a required BASE app joins the composition without
owning it — THIS template is papercusp-agentic-desktop-app's base; a foreign app the
root does not require stays its own composition), and the **full additive
union-of-checks** (`templateId:checkId`) survives. That union IS the app's
definition of done.

Runs wherever `@papercusp/template-kit` is available (it is NOT one of the
dependency-free portable checks):

- **In this repo, unconfigured** — against the sibling `templates/<id>/`
  dirs, as the `@papercusp/templates` workspace suite
  (`npm test -w @papercusp/templates`).
- **Configured** — `TEMPLATE_CHECKS_CONFIG` section
  `composition.templateYamls` names a materialized app's CHOSEN set.

The union rule means an app built from this template must ALSO pass the
closure's aspect suites: `boot-e2e` (`../../papercusp-tauri-desktop-shell/checks/`)
and `components-integrated` (`../../papercusp-data-layer/checks/`,
`../../papercusp-ui/checks/`, plus any optional plane you composed).
