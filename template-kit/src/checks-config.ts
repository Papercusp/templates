/**
 * The checks-config seam (plan app-templates-2026-07-04 P-007): the JSON
 * document an app provides to parameterize the PORTABLE template checks
 * (templates/<id>/checks/*.test.ts — copied verbatim into a composed app and
 * driven via the TEMPLATE_CHECKS_CONFIG env var naming a config file).
 *
 * Every path is resolved relative to `app.root`, which itself resolves
 * relative to the CONFIG FILE's directory (or absolutely); "~/" expands to the
 * user home. A section left out ⇒ that check SKIPS — the config declares
 * which checks the app has wired, and the union-of-checks rule (composition.ts)
 * says which it must eventually wire to be done.
 *
 * This module is the canonical TYPE + structural validator only — the checks
 * themselves stay dependency-free of the kit (they re-declare the tiny slice
 * they read), so the validator here is for tooling: the materializer (P-011)
 * and the template gym (P-009) validate an app's config before running suites.
 */

/** `confinement-guard` — no hive role holds a dangerous capability/tool. */
export interface ChecksConfinementSection {
  /** Blueprint.yaml paths (app-root-relative) whose roles are audited. */
  blueprints: string[];
  /** Patterns: exact ("approvals:write") or resource-wide ("cart:*"). */
  dangerousCapabilities: string[];
  /** Optional — same pattern language, matched against role tools. */
  dangerousTools?: string[];
}

/** `seam-round-trip` — the contract parse gates + join-key echo + reject path. */
export interface ChecksSeamSection {
  /** The ONE seam work-item kind (e.g. "purchase-research"). */
  workItemKind: string;
  /** The contract package entry module, app-root-relative. */
  contractModule: string;
  /** Export name of the payload.in gate (e.g. "parsePurchaseResearchInput"). */
  parseInputExport: string;
  /** Export name of the payload.out gate (e.g. "parseCandidateSet"). */
  parseOutputExport: string;
  /** The id that must round-trip in→out unchanged (e.g. "itemId"). */
  joinKey?: string;
  /** A payload.in fixture the gate must ACCEPT. */
  validInput: Record<string, unknown>;
  /** A payload.out fixture the gate must ACCEPT. */
  validOutput: Record<string, unknown>;
  /** A payload.out fixture the gate must REJECT (throw). */
  invalidOutput: Record<string, unknown>;
  /** Member blueprint.yaml — cross-checked: workItem.kind === workItemKind. */
  memberBlueprint?: string;
  /** The app's own full enqueue→ingest integration leg (must exit 0). */
  roundTripCommand?: string[];
  roundTripCwd?: string;
  roundTripTimeoutMs?: number;
}

/** `boot-e2e` — the composed app boots, writes discovery, health 200. */
export interface ChecksBootSection {
  /**
   * `spawn` boots a fresh sidecar and asserts the full lifecycle including
   * SIGTERM cleanup (CI / gym / fresh checkout). `attach` asserts against an
   * ALREADY-RUNNING instance — the discovery file is a per-user singleton, so
   * never spawn a second instance on a machine where the app is live.
   */
  mode: "spawn" | "attach";
  /** The operator.json analog ("~/…" ok). */
  discoveryFile: string;
  /** Default "/api/health". */
  healthPath?: string;
  /** Optional "app builds" leg, spawn mode only. */
  buildCommand?: string[];
  /** Required in spawn mode: the command that boots the sidecar. */
  command?: string[];
  cwd?: string;
  env?: Record<string, string>;
  readyTimeoutMs?: number;
  shutdownGraceMs?: number;
}

/** `gym-signals` — the hive's guardrail signals are declared and wired. */
export interface ChecksGymSection {
  /** The HIVE blueprint.yaml, app-root-relative. */
  blueprint: string;
  /** The app's ids for the four signal classes. */
  requiredSignals: string[];
}

/** `composition-integrity` — the app's CHOSEN template set (else sibling dirs). */
export interface ChecksCompositionSection {
  templateYamls: string[];
}

/**
 * `components-integrated` (P-017) — the generic check every lib-integration
 * aspect template (data-sync, search, data-layer, ui, release-pipeline)
 * ships: the composed app actually DEPENDS on the template's pinned component
 * packages. `packages` lists the npm package names the app must declare
 * (dependencies or devDependencies, any workspace package.json under root).
 */
export interface ChecksComponentsSection {
  packages: string[];
  /** Package.json paths to search, app-root-relative. Default: ["package.json"]. */
  manifests?: string[];
}

export interface TemplateChecksConfig {
  app: {
    /** The app's name (diagnostics only). */
    name: string;
    /** App repo root, config-file-relative or absolute. Default ".". */
    root?: string;
  };
  confinement?: ChecksConfinementSection;
  seam?: ChecksSeamSection;
  boot?: ChecksBootSection;
  gym?: ChecksGymSection;
  composition?: ChecksCompositionSection;
  components?: ChecksComponentsSection;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isNonEmptyString = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(isNonEmptyString);

function requireStringArray(errors: string[], section: string, field: string, v: unknown, nonEmpty: boolean): void {
  if (!isStringArray(v)) errors.push(`${section}.${field}: must be a list of non-empty strings`);
  else if (nonEmpty && v.length === 0) errors.push(`${section}.${field}: must be non-empty`);
}

/**
 * Structural validation of a checks-config document. Collects EVERY problem;
 * `[]` means valid. Absent optional sections are valid — they mean "that
 * check skips here".
 */
export function validateChecksConfig(value: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(value)) return ["config: must be an object"];

  if (!isRecord(value.app) || !isNonEmptyString(value.app.name)) {
    errors.push("app.name: required non-empty string");
  } else if (value.app.root !== undefined && !isNonEmptyString(value.app.root)) {
    errors.push("app.root: must be a non-empty string when present");
  }

  if (value.confinement !== undefined) {
    if (!isRecord(value.confinement)) errors.push("confinement: must be an object");
    else {
      requireStringArray(errors, "confinement", "blueprints", value.confinement.blueprints, true);
      requireStringArray(errors, "confinement", "dangerousCapabilities", value.confinement.dangerousCapabilities, true);
      if (value.confinement.dangerousTools !== undefined)
        requireStringArray(errors, "confinement", "dangerousTools", value.confinement.dangerousTools, false);
    }
  }

  if (value.seam !== undefined) {
    if (!isRecord(value.seam)) errors.push("seam: must be an object");
    else {
      for (const f of ["workItemKind", "contractModule", "parseInputExport", "parseOutputExport"] as const) {
        if (!isNonEmptyString(value.seam[f])) errors.push(`seam.${f}: required non-empty string`);
      }
      for (const f of ["validInput", "validOutput", "invalidOutput"] as const) {
        if (!isRecord(value.seam[f])) errors.push(`seam.${f}: required object fixture`);
      }
      if (value.seam.roundTripCommand !== undefined)
        requireStringArray(errors, "seam", "roundTripCommand", value.seam.roundTripCommand, true);
    }
  }

  if (value.boot !== undefined) {
    if (!isRecord(value.boot)) errors.push("boot: must be an object");
    else {
      if (value.boot.mode !== "spawn" && value.boot.mode !== "attach")
        errors.push("boot.mode: must be 'spawn' or 'attach'");
      if (!isNonEmptyString(value.boot.discoveryFile)) errors.push("boot.discoveryFile: required non-empty string");
      if (value.boot.mode === "spawn" && !isStringArray(value.boot.command))
        errors.push("boot.command: required (list of strings) in spawn mode");
    }
  }

  if (value.gym !== undefined) {
    if (!isRecord(value.gym)) errors.push("gym: must be an object");
    else {
      if (!isNonEmptyString(value.gym.blueprint)) errors.push("gym.blueprint: required non-empty string");
      requireStringArray(errors, "gym", "requiredSignals", value.gym.requiredSignals, true);
    }
  }

  if (value.composition !== undefined) {
    if (!isRecord(value.composition)) errors.push("composition: must be an object");
    else requireStringArray(errors, "composition", "templateYamls", value.composition.templateYamls, true);
  }

  if (value.components !== undefined) {
    if (!isRecord(value.components)) errors.push("components: must be an object");
    else {
      requireStringArray(errors, "components", "packages", value.components.packages, true);
      if (value.components.manifests !== undefined)
        requireStringArray(errors, "components", "manifests", value.components.manifests, true);
    }
  }

  return errors;
}

/** Parse-or-throw variant (mirrors parseTemplateManifest's contract). */
export function parseChecksConfig(value: unknown): TemplateChecksConfig {
  const errors = validateChecksConfig(value);
  if (errors.length) throw new Error(`invalid checks config: ${errors.join("; ")}`);
  return value as TemplateChecksConfig;
}
