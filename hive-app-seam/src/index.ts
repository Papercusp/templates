/**
 * @papercusp/hive-app-seam — the ONE app⇄hive seam for papercusp hive-apps.
 *
 * A hive-app is a deterministic desktop app whose agentic plane runs inside
 * the user's installed papercusp (the quartermaster / oddsmith shape): two
 * planes joined by exactly ONE seam — work-items UP, a typed contract DOWN
 * through one app-owned parse gate. This lib is the deterministic, shared
 * half of that seam (Tier B template component #1, plan
 * app-templates-2026-07-04):
 *
 *   - {@link ensureAppHives}          first-run bundle + local-install of the
 *                                     app's blueprints + ensure the ops hive
 *   - {@link buildDomainWorkItemsSeam} the generic domain work-items HTTP
 *                                     transport (UP enqueue / DOWN fetch)
 *   - {@link startIngestLoop}         the best-effort DOWN poll cadence
 *
 * Contract parsing (the gate), storage, and app defaults stay APP-SIDE — this
 * lib has zero runtime deps and never validates domain payloads itself.
 */
export {
  ensureAppHives,
  type EnsureAppHivesOpts,
  type HiveBootstrapResult,
} from "./bootstrap.js";
export {
  buildDomainWorkItemsSeam,
  type CompletedDomainWorkItem,
  type DomainWorkItemsSeam,
  type DomainWorkItemsSeamConfig,
} from "./work-items.js";
export {
  startIngestLoop,
  type IngestLoopHandle,
  type IngestLoopOpts,
} from "./ingest-loop.js";
