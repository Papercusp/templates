# @papercusp/hive-app-seam — vendored copy (WI-2891)

Source-vendored from the canonical papercusp-internal monorepo
(`libs/generic/hive-app-seam`), which stays CANONICAL — this copy is synced
with each mirror push and carries the src (minus the test files),
`package.json`, and `tsconfig.json`. Zero runtime deps,
`main: ./src/index.ts` (TypeScript source; consume through vitest/tsx or any
TS-aware loader).

This is the papercusp-ops-hives template's **Tier-B MUST component** — the
ONE app⇄hive seam:

- `ensureAppHives(opts)` — first-run hive bootstrap: bundled-blueprint local
  install with an idempotent fingerprint marker + ensure-hive over the
  operator HTTP API. Best-effort — boot proceeds even when the hive plane is
  off.
- `buildDomainWorkItemsSeam(cfg)` — the generic domain work-items transport
  over `/api/harness/:slug/work-items`. UP: enqueue generic `kind:'task'`
  items carrying the `{ domainKind, blueprintId, input, ... }` payload
  envelope. DOWN: `fetchCompleted()` returns resolved items' **untrusted**
  `payload.out` for your app-owned contract gate. Plus best-effort
  `emitEvent` over the events-emit bridge.
- `startIngestLoop(pass, opts)` — the DOWN poll cadence: run an app-owned
  ingest pass on an interval, best-effort (a throwing pass hits `onError`
  and the loop continues), unref'd, `stop()`-able.

The contract parse gate, storage, and app defaults stay **app-side by
design** — see the `papercusp-ops-hives/GUIDE.md` MUST list.

Consume via a `file:` dependency — the mirror root `package.json` already
does: `"@papercusp/hive-app-seam": "file:./hive-app-seam"`; from your app
repo:
`"@papercusp/hive-app-seam": "file:../<your-mirror-clone>/hive-app-seam"`.
