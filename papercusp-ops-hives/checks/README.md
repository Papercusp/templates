# checks/ — the acceptance suite (landed: plan app-templates-2026-07-04 P-007)

The load-bearing replacement for the old deterministic generator: an app
composed from this template is DONE only when these checks pass,
app-parameterized, ALONGSIDE every other composed template's checks (the
union rule — `@papercusp/template-kit` `composeTemplates`).

## The suites (portable — copy verbatim into the composed app)

| check | file | pins |
|---|---|---|
| `confinement-guard` | `confinement-guard.test.ts` | no hive role's `capabilities:`/`tools:` matches a dangerous pattern (cart/checkout/vault/approvals-write analogs) |
| `seam-round-trip` | `seam-round-trip.test.ts` | the contract package exposes both wire gates; valid in/out payloads parse; the join key echoes unchanged; a malformed payload.out is REJECTED; the member blueprint declares the same seam kind; optionally delegates the live enqueue→ingest leg to the app's own integration suite |
| `gym-signals` | `gym-signals.test.ts` | the hive blueprint declares `gym.collectTrace` + every required guardrail signal id |

## How they run

Each file is self-contained (devDeps: `vitest`, `yaml`) and driven by a JSON
config named via the **`TEMPLATE_CHECKS_CONFIG`** env var — schema:
`@papercusp/template-kit` **`TemplateChecksConfig`** (`checks-config.ts`, the
canonical field docs). Paths resolve relative to `app.root`, which resolves
relative to the config file's dir. **Without the env var every suite SKIPS**
— copying the files never breaks an unwired repo; wiring the config is part
of composing the app.

Worked example: the worked config at
`../../agentic-desktop-app/reference/worked-example.checks-config.json`.

```sh
TEMPLATE_CHECKS_CONFIG=/path/to/checks-config.json npx vitest run checks/
```

In THIS repo the checks also run as the `@papercusp/templates` workspace
(`npm test -w @papercusp/templates`): unconfigured, these three skip and
`composition-integrity` runs — the template gym (P-009) runs them configured.
