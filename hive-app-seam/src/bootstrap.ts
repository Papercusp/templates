/**
 * First-run hive install — the "install my hives into the user's papercusp"
 * half of a hive-app's install procedure.
 *
 * A papercusp hive-app is a SEPARATE desktop app whose agentic plane runs
 * inside the user's ALREADY-INSTALLED papercusp: the app's sidecar pushes
 * domain work-items into its ops hive (see work-items.ts) and the papercusp
 * Queen drains them. For that to work, the app's blueprints must live in the
 * user's papercusp:
 *
 *   <app>-ops        (hive, extends `work`)     — the app's ops Queen
 *   <domain-task>    (harness, extends e.g. `research`) — the per-item worker
 *                    (a `dependencies.blueprints` of the ops hive)
 *
 * This is the BUNDLE + LOCAL-INSTALL path (over create_from_repo / federated):
 * the app ships its blueprint YAMLs, and on first run installs them into the
 * user's papercusp WITHOUT any network/git — mirroring the tail of papercusp's
 * own "standard app procedure" (install a blueprint into the installed tier
 * `~/.papercusp/blueprints/<id>/`, then stand up a hive running it via
 * `POST /api/harness/hives`, exactly what CombBlueprintForm.tsx does).
 *
 * Two steps, both idempotent:
 *   1. copy each bundled blueprint dir → `<papercuspHome>/blueprints/<id>/`
 *      (the installed tier the operator's `extends` resolver reads live — the
 *      same placement `installBlueprintFromCupboardCore` produces).
 *   2. if the ops hive/harness does not already exist, create it via the
 *      operator's `POST /api/harness/hives { slug, blueprintId }`.
 *
 * BEST-EFFORT: a same-machine local papercusp is assumed (step 1 writes to
 * `papercuspHome` directly). Every failure is caught + logged; the caller's
 * boot proceeds regardless. A completion marker (`markerPath`) keyed to a
 * fingerprint of the bundled YAMLs makes it a one-shot that RE-RUNS only when
 * the shipped blueprints change (an app upgrade).
 *
 * Extracted from quartermaster's hive-bootstrap.ts (P-002 of plan
 * app-templates-2026-07-04); quartermaster + oddsmith bind their app defaults
 * on top.
 */
import { createHash } from "node:crypto";
import { cp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

export interface EnsureAppHivesOpts {
  /** The papercusp operator base URL (e.g. QUARTERMASTER_OPERATOR_URL). */
  operatorUrl: string;
  /** Dir holding the bundled blueprint sources (the app's resolveBlueprintsDir()). */
  blueprintsDir: string;
  /** The user's papercusp home — typically `~/.papercusp`. */
  papercuspHome: string;
  /** Where the completion marker is written — e.g. `~/.<app>/hive-install.json`. */
  markerPath: string;
  /** The ops hive's home-harness slug (the work-items seam's target). */
  hiveSlug: string;
  /** The hive blueprint id to run (bundled). Default: `hiveSlug`. */
  hiveBlueprintId?: string;
  /** Blueprint ids to install into the installed tier. */
  blueprintIds: string[];
  /** Learning pack to seed (null = empty memory). Default null. */
  learningPack?: string | null;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  log?: (m: string) => void;
}

export interface HiveBootstrapResult {
  ran: boolean;
  installedBlueprints: string[];
  hive: "created" | "already-exists" | "create-failed" | "not-attempted";
  skippedReason?: string;
  error?: string;
}

const DEFAULT_TIMEOUT_MS = 8_000;

function normalizeBase(base: string): string {
  return base.replace(/\/+$/, "");
}

/** A stable fingerprint of the bundled blueprint YAMLs — changes on app upgrade. */
async function fingerprintBlueprints(blueprintsDir: string, ids: string[]): Promise<string> {
  const h = createHash("sha256");
  for (const id of ids) {
    const dir = join(blueprintsDir, id);
    h.update(`::${id}::`);
    // Hash blueprint.yaml + any adjacent files (fixtures) deterministically.
    let names: string[] = [];
    try {
      names = (await readdir(dir)).sort();
    } catch {
      continue;
    }
    for (const name of names) {
      const p = join(dir, name);
      try {
        h.update(name);
        h.update(await readFile(p));
      } catch {
        /* a dir entry (fixtures/) — skip; blueprint.yaml is the load-bearing one */
      }
    }
  }
  return h.digest("hex");
}

interface Marker {
  fingerprint?: string;
  hiveEnsured?: boolean;
  hiveSlug?: string;
  blueprintIds?: string[];
  at?: string;
}

async function readMarker(markerPath: string): Promise<Marker | null> {
  try {
    return JSON.parse(await readFile(markerPath, "utf8")) as Marker;
  } catch {
    return null;
  }
}

/** Copy one bundled blueprint dir into the installed tier (overwrite, idempotent). */
async function installBlueprint(blueprintsDir: string, papercuspHome: string, id: string): Promise<boolean> {
  const src = join(blueprintsDir, id);
  if (!existsSync(join(src, "blueprint.yaml"))) return false;
  const dest = join(papercuspHome, "blueprints", id);
  await mkdir(dest, { recursive: true });
  await cp(src, dest, { recursive: true, force: true });
  return true;
}

/** Does the hive/harness already exist? Probe its work-items seam (200 = yes). */
async function hiveExists(
  base: string,
  slug: string,
  fetchFn: typeof fetch,
  timeoutMs: number,
): Promise<boolean> {
  try {
    const res = await fetchFn(
      `${base}/api/harness/${encodeURIComponent(slug)}/work-items?kind=task&state=open&limit=1`,
      { signal: AbortSignal.timeout(timeoutMs) },
    );
    return res.ok; // 200 → the harness exists; 404 → not yet
  } catch {
    return false; // unreachable → let the create attempt surface the real error
  }
}

/**
 * Ensure the app's hives are installed into the user's papercusp.
 * Idempotent + best-effort — never throws (returns an `error` field instead).
 */
export async function ensureAppHives(opts: EnsureAppHivesOpts): Promise<HiveBootstrapResult> {
  const log = opts.log ?? (() => {});
  const fetchFn = opts.fetchFn ?? fetch;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const base = normalizeBase(opts.operatorUrl);
  const hiveSlug = opts.hiveSlug;
  const hiveBlueprintId = opts.hiveBlueprintId ?? hiveSlug;
  const blueprintIds = opts.blueprintIds;
  const learningPack = opts.learningPack ?? null;

  const result: HiveBootstrapResult = { ran: false, installedBlueprints: [], hive: "not-attempted" };

  try {
    const fingerprint = await fingerprintBlueprints(opts.blueprintsDir, blueprintIds);
    const marker = await readMarker(opts.markerPath);
    if (marker?.hiveEnsured && marker.fingerprint === fingerprint) {
      log(`hives already installed (fingerprint match) — skipping`);
      result.skippedReason = "marker-up-to-date";
      return result;
    }
    result.ran = true;

    // 1. Install/upgrade the blueprints into the installed tier.
    for (const id of blueprintIds) {
      const ok = await installBlueprint(opts.blueprintsDir, opts.papercuspHome, id);
      if (ok) {
        result.installedBlueprints.push(id);
        log(`installed blueprint '${id}' → ${join(opts.papercuspHome, "blueprints", id)}`);
      } else {
        log(`WARN: bundled blueprint '${id}' not found under ${opts.blueprintsDir} — skipped`);
      }
    }

    // 2. Ensure the hive exists (create only if absent).
    if (await hiveExists(base, hiveSlug, fetchFn, timeoutMs)) {
      log(`hive '${hiveSlug}' already exists — not re-creating`);
      result.hive = "already-exists";
    } else {
      try {
        const res = await fetchFn(`${base}/api/harness/hives`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          signal: AbortSignal.timeout(timeoutMs),
          body: JSON.stringify({ slug: hiveSlug, blueprintId: hiveBlueprintId, learningPack }),
        });
        if (res.ok) {
          log(`hive '${hiveSlug}' created`);
          result.hive = "created";
        } else {
          const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
          const already = /exist|already|taken/i.test(`${body.code ?? ""} ${body.error ?? ""}`);
          if (already) {
            log(`hive '${hiveSlug}' already exists (per create) — ok`);
            result.hive = "already-exists";
          } else {
            result.hive = "create-failed";
            result.error = `hive create HTTP ${res.status}: ${body.error ?? body.code ?? ""}`.trim();
            log(`WARN: ${result.error} — will retry next boot`);
          }
        }
      } catch (err) {
        result.hive = "create-failed";
        result.error = `hive create failed: ${err instanceof Error ? err.message : String(err)}`;
        log(`WARN: ${result.error} — will retry next boot`);
      }
    }

    // 3. Write the marker only when the hive is confirmed present (so a failed
    //    create retries next boot). Blueprint copies persist either way.
    if (result.hive === "created" || result.hive === "already-exists") {
      const marker2: Marker = {
        fingerprint,
        hiveEnsured: true,
        hiveSlug,
        blueprintIds: result.installedBlueprints,
        at: new Date().toISOString(),
      };
      await mkdir(join(opts.markerPath, ".."), { recursive: true }).catch(() => {});
      await writeFile(opts.markerPath, JSON.stringify(marker2, null, 2), "utf8").catch(() => {});
    }
    return result;
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
    log(`hive bootstrap error (non-fatal): ${result.error}`);
    return result;
  }
}
