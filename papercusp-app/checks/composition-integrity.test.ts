/**
 * composition-integrity — the composed template set resolves: manifests valid,
 * pins consistent with the catalog, exactly one ROOT app-scope template per
 * composition, every SELECTING decision point satisfied, and the
 * union-of-checks is the full additive set. (papercusp-app template check;
 * plan app-templates-2026-07-04 P-007 + unified-app-template-2026-08-23 D-001.)
 *
 * Unlike the other checks this one validates the TEMPLATE SET (the composition
 * plan), not the built app — so it runs wherever `@papercusp/template-kit` is
 * available: in the templates repo (where it runs UNCONFIGURED, against the
 * sibling template dirs), in the template gym, and in a materialized app that
 * carries the kit.
 *
 * Config (optional) — TEMPLATE_CHECKS_CONFIG section:
 *   composition: {
 *     templateYamls: string[]   // the app's CHOSEN set, app-root-relative;
 *   }                           // omitted → every sibling template.yaml
 */
import {
  COMPONENT_CATALOG,
  composeTemplates,
  parseTemplateManifest,
  resolveSelection,
  validateTemplateAgainstCatalog,
  validateTemplateSet,
  type TemplateManifest,
} from "@papercusp/template-kit";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
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

/** The chosen set: config-listed yamls, else every sibling template.yaml. */
function resolveTemplateYamls(): string[] {
  const listed = config?.composition?.templateYamls as string[] | undefined;
  if (listed?.length) return listed.map(inApp);
  const templatesDir = join(dirname(fileURLToPath(import.meta.url)), "../..");
  return readdirSync(templatesDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => join(templatesDir, e.name, "template.yaml"))
    .filter((p) => existsSync(p));
}

const ROOT_ID = "papercusp-app";
const yamlPaths = resolveTemplateYamls();
// A config-CHOSEN set is a legitimate SUBSET of the registry: composesWith is
// descriptive affinity and may name templates outside it — only the
// unconfigured registry walk demands every ref resolve.
const chosenSubset = Boolean((config?.composition?.templateYamls as string[] | undefined)?.length);
const manifests: TemplateManifest[] = yamlPaths.map((p) => parseTemplateManifest(parse(readFileSync(p, "utf8"))));
const byId = new Map(manifests.map((m) => [m.id, m]));
const root = byId.get(ROOT_ID) ?? null;

/** The ids this root's own closure + chassis options name, when all are present. */
const CHASSIS_IDS = ["papercusp-tauri-desktop-shell", "papercusp-web-host"] as const;
const INVARIANT_IDS = ["papercusp-data-layer", "papercusp-ui"] as const;
const have = (ids: readonly string[]): boolean => ids.every((id) => byId.has(id));
const pick = (ids: readonly string[]): TemplateManifest[] => ids.map((id) => byId.get(id)!);

/**
 * An app-scope template + its requires-CLOSURE + the transitive closure of
 * composesWith affinity. Hard `requires` edges join FIRST — including an
 * app-scope BASE (a base app is a member of the composition, never its owner).
 * The affinity walk then NEVER absorbs a FOREIGN app-scope template: another
 * app this one does not require is a SEPARATE composition.
 */
function compositionGroup(app: TemplateManifest, registry: Map<string, TemplateManifest>): TemplateManifest[] {
  const group = new Map<string, TemplateManifest>([[app.id, app]]);
  const reqQueue: TemplateManifest[] = [app];
  while (reqQueue.length) {
    const t = reqQueue.shift()!;
    for (const req of t.requires ?? []) {
      const target = registry.get(req.id);
      if (!target || group.has(target.id)) continue;
      group.set(target.id, target);
      reqQueue.push(target);
    }
  }
  const queue = [...group.values()].flatMap((t) => t.composesWith);
  while (queue.length) {
    const id = queue.shift()!;
    if (group.has(id)) continue;
    const t = registry.get(id);
    if (!t) continue; // dangling ref — validateTemplateSet already reports it
    if (t.scope === "app") continue; // a foreign app template is its own composition
    group.set(id, t);
    queue.push(...t.composesWith);
  }
  return [...group.values()];
}

describe("composition-integrity", () => {
  it("every template.yaml in the set parses and validates against the component catalog", () => {
    for (let i = 0; i < manifests.length; i++) {
      const against = validateTemplateAgainstCatalog(manifests[i]!, COMPONENT_CATALOG);
      expect(against.errors, `${yamlPaths[i]}: ${against.errors.join("; ")}`).toEqual([]);
      expect(against.ok).toBe(true);
    }
  });

  it("the set is coherent: unique ids (+ registry-mode composesWith resolution)", () => {
    const set = validateTemplateSet(manifests, { allowExternalComposesWith: chosenSubset });
    expect(set.errors, set.errors.join("; ")).toEqual([]);
    expect(set.ok).toBe(true);
  });

  it("the set contains at least one app-scope template", () => {
    expect(manifests.filter((m) => m.scope === "app").length).toBeGreaterThan(0);
  });

  it("each app-scope template + its composesWith closure composes: ok, pins consistent, full union-of-checks", () => {
    for (const app of manifests.filter((m) => m.scope === "app")) {
      const group = compositionGroup(app, byId);
      const result = composeTemplates(group);
      expect(result.ok, `compose(${app.id}): ${result.errors.join("; ")}`).toBe(true);
      expect(result.composition!.scope).toBe("app");
      expect(result.composition!.appTemplateId).toBe(app.id);

      // The additive union rule — EVERY member template's checks survive,
      // keyed `templateId:checkId`. This is the load-bearing invariant.
      const expected = group.flatMap((t) => t.checks.map((c) => `${t.id}:${c.id}`)).sort();
      const actual = result.composition!.checks.map((c) => `${c.templateId}:${c.item.id}`).sort();
      expect(actual).toEqual(expected);
      expect(actual.length).toBeGreaterThan(0);
    }
  });
});

/**
 * The `target` axis (D-001). These assertions are the reason the collapse from
 * four roots to one did not weaken anything: `requires` used to guarantee a
 * chassis was present, and the selection rule now has to carry that weight.
 *
 * The negative case is deliberate and permanent. A guard that has only ever
 * been observed passing is not evidence — the composition here is exactly the
 * one a builder produces by forgetting to answer `target`, and it MUST fail.
 */
describe.skipIf(!root || !have(INVARIANT_IDS) || !have(CHASSIS_IDS))("papercusp-app target selection", () => {
  it("selecting NO chassis fails to compose — the guarantee `requires` used to give", () => {
    const result = composeTemplates([root!, ...pick(INVARIANT_IDS)]);
    expect(result.ok).toBe(false);
    expect(result.errors.join("; ")).toContain("'target'");
  });

  for (const [answer, chassisId] of [
    ["desktop", "papercusp-tauri-desktop-shell"],
    ["web", "papercusp-web-host"],
  ] as const) {
    it(`target: ${answer} composes, and pulls in ${chassisId}`, () => {
      const resolved = resolveSelection(root!, { target: answer }, manifests);
      expect(resolved.ok, resolved.errors.join("; ")).toBe(true);
      const ids = resolved.templates.map((t) => t.id);
      expect(ids).toContain(chassisId);
      expect(ids).toContain(ROOT_ID);
      for (const id of INVARIANT_IDS) expect(ids).toContain(id);
      // The OTHER chassis must NOT be dragged in — the whole point of the axis.
      for (const other of CHASSIS_IDS.filter((c) => c !== chassisId)) expect(ids).not.toContain(other);
      expect(composeTemplates(resolved.templates).ok).toBe(true);
    });
  }

  it("target: both composes and carries the UNION of both chassis check suites", () => {
    const resolved = resolveSelection(root!, { target: ["desktop", "web"] }, manifests);
    expect(resolved.ok, resolved.errors.join("; ")).toBe(true);
    const composed = composeTemplates(resolved.templates);
    expect(composed.ok, composed.errors.join("; ")).toBe(true);

    // The measured cost of a dual-target app: both chassis' checks, every build.
    const checkIds = composed.composition!.checks.map((c) => `${c.templateId}:${c.item.id}`);
    for (const chassisId of CHASSIS_IDS) {
      const chassisChecks = byId.get(chassisId)!.checks.map((c) => `${chassisId}:${c.id}`);
      for (const id of chassisChecks) expect(checkIds).toContain(id);
    }
  });

  /**
   * P-005: the dual-target tax, PINNED.
   *
   * GUIDE.md, template.yaml and the `dual-target-is-opt-in` MUST all quote
   * "6 declarations vs 5". That is a number DESCRIBING code (the manifests'
   * checks arrays), so it drifts the moment any closure member gains a check —
   * and prose cannot notice. This is the pin: it fails, naming both counts, so
   * whoever adds the check also updates the three places that quote the tax.
   *
   * Read the assertion for what it measures: check DECLARATIONS, not seconds.
   * The single declaration `both` adds is a build-and-boot check, the most
   * expensive kind, so wall clock grows by more than 4→5 suggests.
   */
  it("P-005: `both` costs exactly ONE more check declaration than a single target (6 vs 5)", () => {
    const unionFor = (target: string | string[]) => {
      const r = resolveSelection(root!, { target, agents: "none" }, manifests);
      expect(r.ok, r.errors.join("; ")).toBe(true);
      const c = composeTemplates(r.templates);
      expect(c.ok, c.errors.join("; ")).toBe(true);
      return c.composition!.checks.map((x) => `${x.templateId}:${x.item.id}`).sort();
    };

    const desktop = unionFor("desktop");
    const web = unionFor("web");
    const both = unionFor(["desktop", "web"]);

    expect(desktop.length, `desktop-only union drifted: ${desktop.join(", ")}`).toBe(5);
    expect(web.length, `web-only union drifted: ${web.join(", ")}`).toBe(5);
    expect(both.length, `dual-target union drifted: ${both.join(", ")}`).toBe(6);

    // NOT a doubling: the three non-chassis checks are shared and paid once.
    const shared = desktop.filter((k) => web.includes(k));
    expect(shared).toEqual([
      "papercusp-app:composition-integrity",
      "papercusp-data-layer:components-integrated",
      "papercusp-ui:components-integrated",
      "papercusp-ui:theme-tokens",
    ]);
    // Each chassis contributes exactly one — that one is the whole tax.
    expect(both.length - desktop.length).toBe(1);
    expect(both.filter((k) => !shared.includes(k))).toEqual([
      "papercusp-tauri-desktop-shell:boot-e2e",
      "papercusp-web-host:boot-e2e",
    ]);
  });

  it("an unanswered or unknown `target` is an ERROR, never a silent default", () => {
    expect(resolveSelection(root!, {}, manifests).ok).toBe(false);
    const bogus = resolveSelection(root!, { target: "mainframe" }, manifests);
    expect(bogus.ok).toBe(false);
    expect(bogus.errors.join("; ")).toContain("mainframe");
  });
});

/**
 * The `agents` axis (D-001) — the MUST `agents-are-explicit`, made mechanical.
 *
 * "The agent plane is never implicit" is only prose until something proves the
 * default answer cannot drag it in. That is what the first case here does, and
 * it is why this MUST cites composition-integrity rather than prose-only.
 */
const AGENT_PLANE_ID = "papercusp-ops-pots";
describe.skipIf(!root || !have(INVARIANT_IDS) || !have(CHASSIS_IDS) || !byId.has(AGENT_PLANE_ID))(
  "papercusp-app agent plane selection",
  () => {
    it("agents: none does NOT pull the agent plane in — the plane is never implicit", () => {
      const resolved = resolveSelection(root!, { target: "desktop", agents: "none" }, manifests);
      expect(resolved.ok, resolved.errors.join("; ")).toBe(true);
      expect(resolved.templates.map((t) => t.id)).not.toContain(AGENT_PLANE_ID);
    });

    it("the axis is OPTIONAL — leaving `agents` unanswered is legal and yields no plane", () => {
      const resolved = resolveSelection(root!, { target: "desktop" }, manifests);
      expect(resolved.ok, resolved.errors.join("; ")).toBe(true);
      expect(resolved.templates.map((t) => t.id)).not.toContain(AGENT_PLANE_ID);
    });

    it("agents: pots layers the plane onto the SAME root, on either chassis", () => {
      for (const target of ["desktop", "web"] as const) {
        const resolved = resolveSelection(root!, { target, agents: "pots" }, manifests);
        expect(resolved.ok, `${target}: ${resolved.errors.join("; ")}`).toBe(true);
        const ids = resolved.templates.map((t) => t.id);
        expect(ids).toContain(AGENT_PLANE_ID);
        expect(ids).toContain(ROOT_ID);
        // Still ONE root app — the plane is an aspect layered on, not a second app.
        const composed = composeTemplates(resolved.templates);
        expect(composed.ok, composed.errors.join("; ")).toBe(true);
        expect(composed.composition!.appTemplateId).toBe(ROOT_ID);
        // And its checks are in the union, which is what makes the seam gated.
        const checkIds = composed.composition!.checks.map((c) => `${c.templateId}:${c.item.id}`);
        for (const c of byId.get(AGENT_PLANE_ID)!.checks) expect(checkIds).toContain(`${AGENT_PLANE_ID}:${c.id}`);
      }
    });

    it("an unknown `agents` answer is an ERROR, not a silent 'none'", () => {
      const bogus = resolveSelection(root!, { target: "desktop", agents: "swarm" }, manifests);
      expect(bogus.ok).toBe(false);
      expect(bogus.errors.join("; ")).toContain("swarm");
    });

    it("the four old roots' shapes are all reachable from this ONE root", () => {
      // web/desktop x agents/no-agents — the cross-product the retired roots
      // enumerated as separate templates.
      for (const target of ["desktop", "web"] as const) {
        for (const agents of ["none", "pots"] as const) {
          const resolved = resolveSelection(root!, { target, agents }, manifests);
          expect(resolved.ok, `${target}/${agents}: ${resolved.errors.join("; ")}`).toBe(true);
          expect(composeTemplates(resolved.templates).ok).toBe(true);
        }
      }
    });
  },
);
