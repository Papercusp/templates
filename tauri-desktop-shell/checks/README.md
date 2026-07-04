# checks/ — the acceptance suite (landed: plan app-templates-2026-07-04 P-007)

## `boot-e2e` (`boot-e2e.test.ts`) — the composed app actually boots

Pins the chassis MUSTs end-to-end: sidecar spawns → discovery file
(`operator.json` analog) written → health returns 200 → SIGTERM → clean exit
within the grace window (the WI-2667 force-exit lesson) → discovery file
removed.

Portable + app-parameterized: self-contained (devDep: `vitest`; Node ≥18
fetch), driven by the **`TEMPLATE_CHECKS_CONFIG`** JSON (schema:
`@papercusp/template-kit` `TemplateChecksConfig`, section `boot`). Without
the env var it SKIPS.

**Two modes** — because the discovery file is a per-user singleton:

- **`spawn`** — boots a fresh sidecar (`command`, optional `buildCommand`)
  and asserts the FULL lifecycle including shutdown cleanup. Use in CI, the
  template gym, a fresh checkout. Never on a machine where the app is live —
  a second instance clobbers the live discovery file.
- **`attach`** — asserts against an ALREADY-RUNNING instance: discovery file
  readable, pid alive, health 200. Use on a dev machine with the app live.

```sh
TEMPLATE_CHECKS_CONFIG=/path/to/checks-config.json npx vitest run checks/
```

Worked example config:
`../../agentic-desktop-app/reference/quartermaster.checks-config.json`.
