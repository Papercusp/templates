/**
 * operation-first-triggers — portable check (plan
 * app-agent-tasks-durable-execution-2026-10-06 P-011).
 *
 * Config (TEMPLATE_CHECKS_CONFIG, see @papercusp/template-kit TemplateChecksConfig):
 *   app.root                // app checkout root
 *   seam.rootBlueprint?     // the app's ROOT blueprint (default .papercusp/blueprint.yaml)
 * Runs whenever a `seam` section is configured (an app composed with
 * papercusp-ops-pots); skips otherwise, like every portable check.
 *
 * What it pins:
 * 1. No trigger in the app's own source creates agent work directly: no binding
 *    whose action type is the direct-create kind, and no trigger target naming
 *    the work-item create tool. Agent tasks are blueprint operations submitted
 *    through the seam client; new bindings carry
 *    `action { type: "blueprint-operation", operationHarnessSlug, operationId }`.
 * 2. Every agent-execution operation in the ROOT blueprint names a worker role
 *    declared in that same file. The orchestrator validator refuses a role that
 *    exists only on a dependency blueprint
 *    (app-agent-tasks-durable-execution-2026-10-06#D-003).
 *
 * The forbidden literals are assembled at runtime so this file never matches
 * itself once copied into the app's `checks/` directory. Built-in controls prove
 * the detector is not vacuous.
 */
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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

const section = config?.seam as { rootBlueprint?: string } | undefined;

const DIRECT_CREATE_KIND = ["create", "work", "item"].join("-");
const DIRECT_CREATE_TOOL = ["work_items", "create"].join(":");
const DETECTORS: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  {
    label: `trigger action type ${DIRECT_CREATE_KIND}`,
    pattern: new RegExp(`["']?type["']?\\s*[:=]\\s*["']?${DIRECT_CREATE_KIND}\\b`),
  },
  {
    label: `trigger target ${DIRECT_CREATE_TOOL}`,
    pattern: new RegExp(`["']?(target|tool|action)["']?\\s*[:=]\\s*["']${DIRECT_CREATE_TOOL}["']`),
  },
];

/** Returns one `path:line label` finding per forbidden trigger shape in `text`. */
export function findDirectCreateTriggers(text: string, path: string): string[] {
  const findings: string[] = [];
  text.split("\n").forEach((line, index) => {
    for (const detector of DETECTORS) {
      if (detector.pattern.test(line)) findings.push(`${path}:${index + 1} ${detector.label}`);
    }
  });
  return findings;
}

const SCANNED_EXTENSIONS = /\.(ts|tsx|mts|cts|js|mjs|cjs|json|ya?ml)$/;
const SKIPPED_DIRS = new Set([
  "node_modules", ".git", "dist", "build", "coverage", "target", ".next", ".turbo",
  ".vitest-tmp", "checks", "dist-sidecar", "dist-spa",
]);

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (SKIPPED_DIRS.has(name)) continue;
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) yield* walk(full);
    else if (SCANNED_EXTENSIONS.test(name) && stat.size < 2_000_000) yield full;
  }
}

/** The directory scanner used by both configured app checks and fixture controls. */
export function findAppDirectCreateTriggers(root: string): string[] {
  const findings: string[] = [];
  for (const file of walk(root)) {
    findings.push(...findDirectCreateTriggers(readFileSync(file, "utf8"), relative(root, file)));
  }
  return findings;
}

/** Returns one `operationId -> role` finding per agent-execution operation whose role is not declared in `doc.roles`. */
export function findUndeclaredAgentRoles(doc: unknown): string[] {
  const blueprint = (doc ?? {}) as {
    roles?: Array<{ id?: string }>;
    operations?: Array<{ id?: string; execution?: { kind?: string; role?: string } }>;
  };
  const declared = new Set((blueprint.roles ?? []).map((role) => role.id));
  return (blueprint.operations ?? [])
    .filter((operation) => operation.execution?.kind === "agent")
    .filter((operation) => !declared.has(operation.execution?.role))
    .map((operation) => `${operation.id} -> ${operation.execution?.role}`);
}

// The template's own shipped reference root blueprint (absent once this check is
// copied into an app's checks/ directory, where the gated block below applies).
const REFERENCE_ROOT_BLUEPRINT = join(dirname(fileURLToPath(import.meta.url)), "..", "reference", "app-root.blueprint.yaml");
const fillPlaceholders = (text: string): string => text.replace(/\{\{[A-Z0-9_]+\}\}/g, "x");

describe("operation-first-triggers role-declaration controls", () => {
  const agentOperation = { id: "draft", execution: { kind: "agent", role: "draft-worker" } };

  it("flags an agent operation whose role is declared only elsewhere (positive control)", () => {
    expect(findUndeclaredAgentRoles({ operations: [agentOperation] })).toEqual(["draft -> draft-worker"]);
    expect(findUndeclaredAgentRoles({ roles: [{ id: "other" }], operations: [agentOperation] })).toHaveLength(1);
  });

  it("passes a declared role and a plan-target operation (negative control)", () => {
    expect(findUndeclaredAgentRoles({ roles: [{ id: "draft-worker" }], operations: [agentOperation] })).toEqual([]);
    expect(findUndeclaredAgentRoles({ operations: [{ id: "run", target: { kind: "plan" } }] })).toEqual([]);
  });
});

describe.skipIf(!existsSync(REFERENCE_ROOT_BLUEPRINT))("operation-first-triggers reference root blueprint", () => {
  it("declares at least one operation in the ROOT blueprint and every agent role locally", () => {
    const doc = parse(fillPlaceholders(readFileSync(REFERENCE_ROOT_BLUEPRINT, "utf8"))) as { operations?: unknown[] };
    expect(doc.operations?.length ?? 0).toBeGreaterThan(0);
    expect(findUndeclaredAgentRoles(doc)).toEqual([]);
  });

  it("contains no direct-create trigger shape", () => {
    const text = readFileSync(REFERENCE_ROOT_BLUEPRINT, "utf8");
    expect(findDirectCreateTriggers(text, "reference/app-root.blueprint.yaml")).toEqual([]);
  });
});

describe("operation-first-triggers detector controls", () => {
  it("flags each forbidden trigger shape (positive controls)", () => {
    const yamlBinding = `action:\n  type: ${DIRECT_CREATE_KIND}\n`;
    const jsonBinding = `{ "action": { "type": "${DIRECT_CREATE_KIND}" } }`;
    const tsBinding = `bind({ target: '${DIRECT_CREATE_TOOL}', kind: 'x' })`;
    expect(findDirectCreateTriggers(yamlBinding, "a.yaml")).toHaveLength(1);
    expect(findDirectCreateTriggers(jsonBinding, "a.json")).toHaveLength(1);
    expect(findDirectCreateTriggers(tsBinding, "a.ts")).toHaveLength(1);
  });

  it("passes the operation-first binding shape (negative control)", () => {
    const operationBinding =
      'action: { type: "blueprint-operation", operationHarnessSlug: "crm", operationId: "lead-qualification" }';
    expect(findDirectCreateTriggers(operationBinding, "a.ts")).toEqual([]);
  });
});

describe.skipIf(!existsSync(REFERENCE_ROOT_BLUEPRINT))("operation-first-triggers materialized fixture controls", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "operation-first-app-fixture-"));
    mkdirSync(join(root, ".papercusp"));
    mkdirSync(join(root, "src"));
    // Materialize the maintained reference exactly where its GUIDE tells apps
    // to put it, substituting fixture values for the builder's placeholders.
    writeFileSync(join(root, ".papercusp", "blueprint.yaml"),
      fillPlaceholders(readFileSync(REFERENCE_ROOT_BLUEPRINT, "utf8")));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it("passes the materialized reference default with a declared operation", () => {
    const doc = parse(readFileSync(join(root, ".papercusp", "blueprint.yaml"), "utf8"));
    expect(doc.operations.length).toBeGreaterThan(0);
    expect(findUndeclaredAgentRoles(doc)).toEqual([]);
    expect(findAppDirectCreateTriggers(root)).toEqual([]);
  });

  it("passes a materialized app whose source trigger targets an operation", () => {
    writeFileSync(join(root, "src", "triggers.ts"),
      'export const binding = { action: { type: "blueprint-operation", operationHarnessSlug: "fixture", operationId: "x" } };');
    expect(findAppDirectCreateTriggers(root)).toEqual([]);
  });

  it("fails the app check when a materialized source trigger directly creates work", () => {
    writeFileSync(join(root, "src", "triggers.ts"),
      `export const binding = { action: { tool: "${DIRECT_CREATE_TOOL}" } };`);
    const findings = findAppDirectCreateTriggers(root);
    expect(findings).toEqual([`src/triggers.ts:1 trigger target ${DIRECT_CREATE_TOOL}`]);
    expect(() => expect(findings).toEqual([])).toThrow();
  });
});

describe.skipIf(!section)("operation-first-triggers", () => {
  it("no trigger in the app's source creates agent work directly", () => {
    const findings = findAppDirectCreateTriggers(appRoot!);
    expect(
      findings,
      "agent tasks must be blueprint operations submitted through the seam client " +
        '(action { type: "blueprint-operation", operationHarnessSlug, operationId }), never a direct create',
    ).toEqual([]);
  });

  it("every agent-execution operation's role is declared in the root blueprint", () => {
    const doc = parse(readFileSync(inApp(section!.rootBlueprint ?? ".papercusp/blueprint.yaml"), "utf8"));
    expect(findUndeclaredAgentRoles(doc), "declare each worker role in the root blueprint's roles[] (D-003)").toEqual([]);
  });
});
