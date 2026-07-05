/**
 * The generic app⇄papercusp DOMAIN WORK-ITEMS transport — the deterministic
 * half of the ONE composition seam between a hive-app and its ops hive.
 *
 *   UP   — the app enqueues one generic `kind:'task'` work-item per unit of
 *          agent work, carrying the DOMAIN envelope in the payload:
 *          `{ domainKind, blueprintId, input, ...extras }`. The domain kind is
 *          a PAYLOAD discriminator, NOT a work_items kind (the oddsmith
 *          bet-analysis / quartermaster purchase-research pattern, D-009/D-014).
 *   DOWN — completed (resolved) items carry the agent's output as
 *          `payload.out` (the researcher completes with `outputPayload`, which
 *          the operator persists onto the item). {@link DomainWorkItemsSeam.fetchCompleted}
 *          returns those outputs UNVALIDATED — the app's contract parser (e.g.
 *          `parseCandidateSet`) is the ONLY gate, and it lives app-side.
 *
 * Everything rides the operator's harness seam
 * (`/api/harness/:slug/work-items`) plus the events-emit bridge
 * (`/api/operator/events-emit`). Transport is PLUGGABLE: production binds real
 * `fetch` to the operator URL; tests inject fakes.
 *
 * Extracted from quartermaster's research-seam transport + oddsmith's
 * harness-ops-wiring `buildHttpWorkItems` (P-002 of plan
 * app-templates-2026-07-04). The two apps bind their domain configs on top.
 */

export interface DomainWorkItemsSeamConfig {
  /** The papercusp operator base URL. */
  operatorUrl: string;
  /** The ops hive's harness slug (`/api/harness/<slug>/work-items`). */
  slug: string;
  /** The payload domain discriminator (`payload.domainKind`), e.g. `purchase-research`. */
  domainKind: string;
  /** The blueprint id stamped on enqueued payloads. Default: `domainKind`. */
  blueprintId?: string;
  /** The generic work_items kind used on the wire. Default: `task`. */
  workItemKind?: string;
  /** `createdBy` stamped on enqueued items, e.g. `quartermaster-sidecar`. */
  createdBy: string;
  /** `limit` on list reads. Default 2000. */
  listLimit?: number;
  /**
   * Per-request timeout. When set, every call carries `AbortSignal.timeout`;
   * when unset, calls have NO timeout (some hosts prefer the raw fetch
   * semantics — this preserves each app's existing behavior exactly).
   */
  timeoutMs?: number;
  fetchFn?: typeof fetch;
  log?: (m: string) => void;
}

/** One completed domain work-item pulled DOWN from papercusp. */
export interface CompletedDomainWorkItem {
  workItemId: string;
  /** The untrusted `payload.out` — the app's contract gate validates it. */
  output: unknown;
}

/** The generic domain work-items seam — HTTP in production, fakes in tests. */
export interface DomainWorkItemsSeam {
  /** Raw work-items rows for one state (`?kind=<kind>&state=<state>&limit=<n>`). */
  listByState(state: string): Promise<unknown[]>;
  /** Payloads of OPEN items whose `payload.domainKind` matches (enqueue dedup). */
  listOpenPayloads(): Promise<Array<Record<string, unknown>>>;
  /**
   * Enqueue one domain work-item as a generic `kind:'task'` row whose payload
   * is `{ domainKind, blueprintId, input, ...extraPayload }`. Returns the raw
   * `{ id? }` — the HOST decides whether a missing id is an error (apps
   * differ), but a non-2xx ALWAYS throws.
   */
  enqueue(
    input: unknown,
    meta: { title: string; summary: string; extraPayload?: Record<string, unknown> },
  ): Promise<{ id?: string }>;
  /** Resolved items of this domain that carry a `payload.out` (the DOWN leg). */
  fetchCompleted(): Promise<CompletedDomainWorkItem[]>;
  /** Best-effort domain-event emit UP (events-emit bridge) — MUST never throw. */
  emitEvent(event: string, payload: Record<string, unknown>): Promise<void>;
}

const EVENTS_EMIT_PATH = "/api/operator/events-emit";
const DEFAULT_LIST_LIMIT = 2000;

function normalizeBase(base: string): string {
  return base.replace(/\/+$/, "");
}

/** Narrow an untrusted work-items row to `{ id?, payload? }`. */
function rowOf(item: unknown): { id?: string; payload?: Record<string, unknown> } {
  const id = (item as { id?: unknown } | undefined)?.id;
  const payload = (item as { payload?: unknown } | undefined)?.payload;
  return {
    ...(typeof id === "string" ? { id } : {}),
    ...(payload && typeof payload === "object" ? { payload: payload as Record<string, unknown> } : {}),
  };
}

/**
 * Build the production HTTP seam over the operator's harness work-items API.
 * All reads/writes go through the injected `fetchFn` (default global fetch).
 */
export function buildDomainWorkItemsSeam(cfg: DomainWorkItemsSeamConfig): DomainWorkItemsSeam {
  const base = normalizeBase(cfg.operatorUrl);
  const fetchFn = cfg.fetchFn ?? fetch;
  const log = cfg.log ?? (() => {});
  const workItemKind = cfg.workItemKind ?? "task";
  const blueprintId = cfg.blueprintId ?? cfg.domainKind;
  const listLimit = cfg.listLimit ?? DEFAULT_LIST_LIMIT;
  const itemsUrl = `${base}/api/harness/${encodeURIComponent(cfg.slug)}/work-items`;
  /** `AbortSignal.timeout` when configured; NO signal otherwise (host semantics). */
  const signalInit = (): { signal?: AbortSignal } =>
    cfg.timeoutMs !== undefined ? { signal: AbortSignal.timeout(cfg.timeoutMs) } : {};

  async function listByState(state: string): Promise<unknown[]> {
    const res = await fetchFn(
      `${itemsUrl}?kind=${encodeURIComponent(workItemKind)}&state=${encodeURIComponent(state)}&limit=${listLimit}`,
      { ...signalInit() },
    );
    if (!res.ok) throw new Error(`work-items list (state=${state}) HTTP ${res.status}`);
    const body = (await res.json()) as { workItems?: unknown[] };
    return body.workItems ?? [];
  }

  return {
    listByState,

    async listOpenPayloads(): Promise<Array<Record<string, unknown>>> {
      const payloads: Array<Record<string, unknown>> = [];
      for (const item of await listByState("open")) {
        const { payload } = rowOf(item);
        if (payload && payload.domainKind === cfg.domainKind) payloads.push(payload);
      }
      return payloads;
    },

    async enqueue(input, meta): Promise<{ id?: string }> {
      const res = await fetchFn(itemsUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        ...signalInit(),
        body: JSON.stringify({
          // The generic issue-family work_items kind; the DOMAIN kind rides
          // the payload (oddsmith bet-analysis pattern, D-009/D-014).
          kind: workItemKind,
          title: meta.title,
          summary: meta.summary,
          createdBy: cfg.createdBy,
          payload: {
            domainKind: cfg.domainKind,
            blueprintId,
            input,
            ...(meta.extraPayload ?? {}),
          },
        }),
      });
      if (!res.ok) throw new Error(`work-item create HTTP ${res.status}`);
      const body = (await res.json()) as { id?: string };
      return { ...(typeof body.id === "string" ? { id: body.id } : {}) };
    },

    async fetchCompleted(): Promise<CompletedDomainWorkItem[]> {
      const out: CompletedDomainWorkItem[] = [];
      for (const item of await listByState("resolved")) {
        const { id, payload } = rowOf(item);
        if (!payload || payload.domainKind !== cfg.domainKind) continue;
        if (payload.out === undefined) continue; // no payload.out yet — the papercusp half hasn't completed it
        if (typeof id !== "string") continue;
        out.push({ workItemId: id, output: payload.out });
      }
      return out;
    },

    async emitEvent(event, payload): Promise<void> {
      // Best-effort, swallowed on ANY failure — emitting an event must never
      // throw into a route or a loop.
      try {
        const res = await fetchFn(`${base}${EVENTS_EMIT_PATH}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          ...signalInit(),
          body: JSON.stringify({ event, payload }),
        });
        if (!res.ok) log(`events-emit ${res.status} — event "${event}" dropped (best-effort)`);
      } catch (err) {
        log(`events-emit failed (${err instanceof Error ? err.message : String(err)}) — event "${event}" dropped`);
      }
    },
  };
}
