/**
 * seam-round-trip — enqueue-shape → complete-shape → contract parse gate.
 * (papercusp-ops-hives template check; plan app-templates-2026-07-04 P-007.)
 *
 * PORTABLE + APP-PARAMETERIZED: copied verbatim into a composed app, driven by
 * the TEMPLATE_CHECKS_CONFIG JSON (schema: @papercusp/template-kit
 * `TemplateChecksConfig`, section `seam`). Skips without the env var. Needs
 * only `vitest` + `yaml` devDeps (plus the app's own contract package, which
 * this check imports through the config).
 *
 * Config section:
 *   seam: {
 *     workItemKind: string        // the ONE seam kind (e.g. "purchase-research")
 *     contractModule: string      // the contract package entry, app-root-relative
 *     parseInputExport: string    // the payload.in gate  (e.g. "parsePurchaseResearchInput")
 *     parseOutputExport: string   // the payload.out gate (e.g. "parseCandidateSet")
 *     joinKey?: string            // the id that must round-trip in→out (e.g. "itemId")
 *     validInput: object          // a payload.in fixture the gate must ACCEPT
 *     validOutput: object         // a payload.out fixture the gate must ACCEPT
 *     invalidOutput: object       // a payload.out fixture the gate must REJECT
 *     memberBlueprint?: string    // member blueprint.yaml — cross-checks workItem.kind
 *     roundTripCommand?: string[] // OPTIONAL: the app's own full enqueue→ingest
 *     roundTripCwd?: string       //   integration leg (spawned, must exit 0)
 *     roundTripTimeoutMs?: number //   default 300000
 *   }
 *
 * What it pins: the app's contract package exposes the two wire gates; a valid
 * in-payload and out-payload parse; the join key echoes UNCHANGED through the
 * round trip; a malformed out-payload is REJECTED (never silently ingested —
 * the reject is what the ingest-sentinel reacts to); and the member blueprint
 * declares the same seam kind. The live enqueue→DB-row leg is app
 * infrastructure — delegate it via `roundTripCommand` to the app's own
 * integration suite (quartermaster: the research-seam tests).
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { parse } from "yaml";

// ── config preamble (identical across the portable checks) ──────────────────
const untilde = (p: string): string => (p.startsWith("~/") ? join(homedir(), p.slice(2)) : p);
const configPath = process.env.TEMPLATE_CHECKS_CONFIG;
const config: Record<string, any> | null = configPath
  ? JSON.parse(readFileSync(resolve(untilde(configPath)), "utf8"))
  : null;
const appRoot: string | null = config
  ? resolve(dirname(resolve(untilde(configPath!))), untilde(config.app?.root ?? "."))
  : null;
const inApp = (p: string): string => (isAbsolute(untilde(p)) ? untilde(p) : join(appRoot!, p));
// ─────────────────────────────────────────────────────────────────────────────

interface SeamSection {
  workItemKind: string;
  contractModule: string;
  parseInputExport: string;
  parseOutputExport: string;
  joinKey?: string;
  validInput: Record<string, unknown>;
  validOutput: Record<string, unknown>;
  invalidOutput: Record<string, unknown>;
  memberBlueprint?: string;
  roundTripCommand?: string[];
  roundTripCwd?: string;
  roundTripTimeoutMs?: number;
}
const section = config?.seam as SeamSection | undefined;

describe.skipIf(!section)("seam-round-trip", () => {
  let contracts: Record<string, unknown>;
  let parseIn: (json: unknown) => Record<string, unknown>;
  let parseOut: (json: unknown) => Record<string, unknown>;

  beforeAll(async () => {
    contracts = (await import(pathToFileURL(inApp(section!.contractModule)).href)) as Record<string, unknown>;
    parseIn = contracts[section!.parseInputExport] as typeof parseIn;
    parseOut = contracts[section!.parseOutputExport] as typeof parseOut;
  });

  it("the contract package exposes both wire gates", () => {
    expect(typeof parseIn, `missing export ${section!.parseInputExport}`).toBe("function");
    expect(typeof parseOut, `missing export ${section!.parseOutputExport}`).toBe("function");
  });

  it("a valid payload.in passes the UP gate", () => {
    expect(parseIn(section!.validInput)).toBeTruthy();
  });

  it("a valid payload.out passes the DOWN gate", () => {
    expect(parseOut(section!.validOutput)).toBeTruthy();
  });

  it("the join key echoes unchanged through the round trip", () => {
    const key = section!.joinKey;
    if (!key) return; // no join key declared — nothing to pin
    const upstream = parseIn(section!.validInput)[key];
    const downstream = parseOut(section!.validOutput)[key];
    expect(upstream, `validInput.${key} missing`).toBeDefined();
    expect(downstream, `${key} did not round-trip: in=${String(upstream)} out=${String(downstream)}`).toEqual(upstream);
  });

  it("a malformed payload.out is REJECTED by the gate (never silently ingested)", () => {
    expect(() => parseOut(section!.invalidOutput)).toThrow();
  });

  it("the member blueprint declares the same seam kind", () => {
    if (!section!.memberBlueprint) return;
    const doc = parse(readFileSync(inApp(section!.memberBlueprint), "utf8")) as {
      workItem?: { kind?: string };
    };
    expect(doc.workItem?.kind).toBe(section!.workItemKind);
  });

  it(
    "the app's own enqueue→ingest integration leg is green (roundTripCommand)",
    { timeout: 330_000 },
    () => {
      if (!section!.roundTripCommand?.length) return;
      const [cmd, ...args] = section!.roundTripCommand;
      const run = spawnSync(cmd!, args, {
        cwd: section!.roundTripCwd ? inApp(section!.roundTripCwd) : appRoot!,
        encoding: "utf8",
        timeout: section!.roundTripTimeoutMs ?? 300_000,
      });
      expect(
        run.status,
        `roundTripCommand exited ${run.status}\n--- stdout ---\n${run.stdout}\n--- stderr ---\n${run.stderr}`,
      ).toBe(0);
    },
  );
});
