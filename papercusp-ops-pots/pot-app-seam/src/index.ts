/**
 * @papercusp/pot-app-seam
 *
 * A Tier-B host seam for agentic apps: deterministic app code can bootstrap
 * required pots, enqueue requests to the judgment plane, and ingest judged
 * outputs without importing a concrete operator, database, or queue.
 */

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  readonly [key: string]: JsonValue;
}

export interface PotSpec {
  readonly slug: string;
  readonly title?: string;
  readonly blueprint?: string;
  readonly templateId?: string;
  readonly metadata?: JsonObject;
}

export interface BootstrapPotsInput {
  readonly pots: readonly PotSpec[];
  /** Idempotency marker name in the host store. Defaults to a stable hash. */
  readonly marker?: string;
}

export interface BootstrapPotResult {
  readonly slug: string;
  readonly created: boolean;
  readonly ref?: string;
}

export interface BootstrapPotsResult {
  readonly marker: string;
  readonly fingerprint: string;
  readonly skipped: boolean;
  readonly pots: readonly BootstrapPotResult[];
}

export interface AppExecutionTarget {
  readonly appHarnessSlug: string;
  readonly agentName: string;
}

export interface PlanRunDraft<TInput extends JsonObject = JsonObject> {
  /** Installed app-owned plan template. The host instantiates this template. */
  readonly templateSlug: string;
  readonly input: TInput;
  /** Immutable source/event identity retained on the canonical plan run. */
  readonly provenance: JsonObject;
  readonly execution: AppExecutionTarget;
  /** Stable replay key. Hosts must return the existing run for a replay. */
  readonly dedupeKey?: string;
}

export interface LaunchedPlanRun {
  readonly runId: string;
  readonly planSlug: string;
  readonly workItemIds: readonly string[];
  readonly assignedAgentName: string;
  readonly dedupeKey?: string;
  /** A run is not launched successfully unless its actionable frontier was dispatched. */
  readonly dispatch: {
    readonly status: 'delivered' | 'retryable-failure';
    readonly assignedWorkItemIds: readonly string[];
    readonly wakeAcknowledged: boolean;
    readonly reason?: string;
  };
}

export interface IngestEvent {
  readonly id: string;
  readonly payload: unknown;
}

export interface IngestCursor {
  readonly eventId: string;
}

export interface IngestSubscription {
  /** Resolves when the source drains or rejects if the loop fails without an onError handler. */
  readonly done: Promise<void>;
  stop(): Promise<void> | void;
}

export interface StartIngestLoopInput<TParsed> {
  readonly source: AsyncIterable<IngestEvent>;
  readonly parse: (event: IngestEvent) => Promise<TParsed> | TParsed;
  readonly store: (parsed: TParsed, cursor: IngestCursor) => Promise<void> | void;
  readonly onError?: (error: unknown, event: IngestEvent) => Promise<void> | void;
  readonly signal?: AbortSignal;
}

export interface PotAppSeamHost {
  readBootstrapMarker(marker: string): Promise<string | null> | string | null;
  writeBootstrapMarker(marker: string, fingerprint: string): Promise<void> | void;
  ensurePot(spec: PotSpec): Promise<BootstrapPotResult> | BootstrapPotResult;
  /**
   * Instantiate through the canonical plan-run/promote/dispatch path. Implementations
   * must never translate this call into a bare work_items:create.
   */
  launchPlanRun(draft: PlanRunDraft): Promise<LaunchedPlanRun> | LaunchedPlanRun;
}

export interface PotAppSeam {
  bootstrapPots(input: BootstrapPotsInput): Promise<BootstrapPotsResult>;
  launchPlanRuns(runs: readonly PlanRunDraft[]): Promise<readonly LaunchedPlanRun[]>;
  startIngestLoop<TParsed>(input: StartIngestLoopInput<TParsed>): IngestSubscription;
}

function assertNonEmpty(value: string, label: string): void {
  if (value.trim().length === 0) throw new Error(`${label} must be non-empty`);
}

function stableJson(value: JsonValue): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => stableJson(v)).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableJson(value[k])}`).join(',')}}`;
}

function fingerprintPots(pots: readonly PotSpec[]): string {
  const normalized = pots
    .map((h) => ({
      slug: h.slug,
      title: h.title ?? '',
      blueprint: h.blueprint ?? '',
      templateId: h.templateId ?? '',
      metadata: h.metadata ?? {},
    }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
  return stableJson(normalized);
}

function defaultMarker(pots: readonly PotSpec[]): string {
  return `pot-app-seam:${pots.map((h) => h.slug).sort().join('+')}`;
}

export function createPotAppSeam(host: PotAppSeamHost): PotAppSeam {
  return {
    async bootstrapPots(input) {
      if (input.pots.length === 0) throw new Error('bootstrapPots requires at least one pot');
      for (const pot of input.pots) assertNonEmpty(pot.slug, 'pot.slug');

      const fingerprint = fingerprintPots(input.pots);
      const marker = input.marker ?? defaultMarker(input.pots);
      const existing = await host.readBootstrapMarker(marker);
      if (existing === fingerprint) {
        return { marker, fingerprint, skipped: true, pots: [] };
      }

      const pots: BootstrapPotResult[] = [];
      for (const pot of input.pots) pots.push(await host.ensurePot(pot));
      await host.writeBootstrapMarker(marker, fingerprint);
      return { marker, fingerprint, skipped: false, pots };
    },

    async launchPlanRuns(runs) {
      if (runs.length === 0) return [];
      const out: LaunchedPlanRun[] = [];
      for (const run of runs) {
        assertNonEmpty(run.templateSlug, 'plan template slug');
        assertNonEmpty(run.execution.appHarnessSlug, 'execution.appHarnessSlug');
        assertNonEmpty(run.execution.agentName, 'execution.agentName');
        const launched = await host.launchPlanRun(run);
        if (launched.assignedAgentName !== run.execution.agentName) {
          throw new Error(
            `plan run ${launched.runId} assigned ${launched.assignedAgentName}, expected ${run.execution.agentName}`,
          );
        }
        if (launched.dispatch.status !== 'delivered' || !launched.dispatch.wakeAcknowledged) {
          throw new Error(
            `plan run ${launched.runId} dispatch failed retryably: ${launched.dispatch.reason ?? 'target did not acknowledge wake'}`,
          );
        }
        out.push(launched);
      }
      return out;
    },

    startIngestLoop(input) {
      let stopped = false;
      const stop = () => {
        stopped = true;
      };
      const run = async () => {
        for await (const event of input.source) {
          if (stopped || input.signal?.aborted) break;
          try {
            const parsed = await input.parse(event);
            await input.store(parsed, { eventId: event.id });
          } catch (error) {
            if (input.onError) await input.onError(error, event);
            else throw error;
          }
        }
      };
      const running = run();
      return {
        done: running,
        async stop() {
          stop();
          await running.catch(() => {});
        },
      };
    },
  };
}

export function isJsonObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
