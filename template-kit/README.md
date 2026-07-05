# @papercusp/template-kit — vendored copy (WI-2860)

Source-vendored from the papercup monorepo (`libs/generic/template-kit/`),
which stays CANONICAL — this copy is synced with each mirror push and carries
the src (minus the repo-pinning test files), `package.json`, and
`tsconfig.json`. Zero runtime deps, `main: ./src/index.ts` (TypeScript
source; consume through vitest/tsx or any TS-aware loader). YAML parsing
stays in the consumer, so `yaml` is your dependency, not the kit's.

Consume via a `file:` dependency — the mirror root `package.json` already
does: `"@papercusp/template-kit": "file:./template-kit"`.
