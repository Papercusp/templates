# papercusp-agentic-webapp — check contracts

## `composition-integrity` (`composition-integrity.test.ts`) — the set resolves

The SAME portable check the papercusp-agentic-desktop-app template ships
(copied verbatim). Validates the TEMPLATE SET (the composition plan), not the
built app: every `template.yaml` parses + matches the component catalog (no
stale pins), the set is coherent (unique ids, resolvable `composesWith`), and
each app-scope template + its `requires` closure + its `composesWith` affinity
composes via `@papercusp/template-kit` `composeTemplates` — pins consistent,
exactly one ROOT app scope (a required BASE app, e.g. papercusp-webapp under
THIS template, joins the composition without owning it; a foreign app the
root does not require stays a separate composition), and the **full additive
union-of-checks** (`templateId:checkId`) survives. That union IS the app's
definition of done.

Runs wherever `@papercusp/template-kit` is available (it is NOT one of the
dependency-free portable checks):

- **In this repo, unconfigured** — against the sibling `templates/<id>/`
  dirs. (There is no `@papercusp/templates` npm workspace: in-repo the
  composition semantics are pinned by `@papercusp/template-kit`'s own suite —
  `templates-dir.test.ts` + `composition.test.ts` — and by the
  operator-core `template-bundle-integrity` guard.)
- **Configured** — `TEMPLATE_CHECKS_CONFIG` section
  `composition.templateYamls` names a materialized app's CHOSEN set.

The union rule means an app built from this template must ALSO pass the
closure's suites: `confinement-guard` / `seam-round-trip` / `gym-signals`
(`../../papercusp-ops-pots/checks/`), `boot-e2e`
(`../../papercusp-web-host/checks/`), `components-integrated`
(`../../papercusp-data-layer/checks/`, `../../papercusp-ui/checks/`, plus any
optional plane you composed), and the papercusp-webapp base's own
`composition-integrity`.
