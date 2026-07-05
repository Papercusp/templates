/**
 * composition-integrity — the composed template set resolves: manifests valid,
 * pins consistent with the catalog, exactly one ROOT app-scope template per
 * composition (P-022: an app may require another app as its BASE), and the
 * union-of-checks is the full additive set. (agentic-
 * papercusp-desktop-app template check; plan app-templates-2026-07-04 P-007.)
 *
 * Unlike the other checks this one validates the TEMPLATE SET (the
 * composition plan), not the built app — so it runs wherever
 * `@papercusp/template-kit` is available: in the templates repo (papercup —
 * where it runs UNCONFIGURED, against the sibling `templates/<id>/` dirs), in
 * the template gym (P-009), and in a materialized app that carries the kit.
 *
 * Config (optional) — TEMPLATE_CHECKS_CONFIG section:
 *   composition: {
 *     templateYamls: string[]   // the app's CHOSEN set, app-root-relative;
 *   }                           // omitted → every ../../<id>/template.yaml
 */
import {
  COMPONENT_CATALOG,
  composeTemplates,
  parseTemplateManifest,
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

/** The chosen set: config-listed yamls, else every sibling templates/<id>/template.yaml. */
function resolveTemplateYamls(): string[] {
  const listed = config?.composition?.templateYamls as string[] | undefined;
  if (listed?.length) return listed.map(inApp);
  const templatesDir = join(dirname(fileURLToPath(import.meta.url)), "../..");
  return readdirSync(templatesDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => join(templatesDir, e.name, "template.yaml"))
    .filter((p) => existsSync(p));
}

const yamlPaths = resolveTemplateYamls();
// A config-CHOSEN set is a legitimate SUBSET of the registry: composesWith is
// descriptive affinity and may name templates outside it (WI-2881) — only the
// unconfigured registry walk demands every ref resolve.
const chosenSubset = Boolean((config?.composition?.templateYamls as string[] | undefined)?.length);
const manifests: TemplateManifest[] = yamlPaths.map((p) => parseTemplateManifest(parse(readFileSync(p, "utf8"))));

/**
 * An app-scope template + its requires-CLOSURE + the transitive closure of
 * composesWith affinity. Hard `requires` edges join FIRST — including an
 * app-scope BASE (P-022: papercusp-agentic-desktop-app requires papercusp-desktop-app; a base
 * app is a member of the composition, never its owner — composeTemplates'
 * root-app rule). The affinity walk then NEVER absorbs a FOREIGN app-scope
 * template: composesWith is descriptive affinity (an aspect may name every
 * app that consumes it), but another app this one does not require is a
 * SEPARATE composition, not a member of this one.
 */
function compositionGroup(app: TemplateManifest, byId: Map<string, TemplateManifest>): TemplateManifest[] {
  const group = new Map<string, TemplateManifest>([[app.id, app]]);
  // 1) requires-closure — hard pinned edges, app-scope bases included.
  const reqQueue: TemplateManifest[] = [app];
  while (reqQueue.length) {
    const t = reqQueue.shift()!;
    for (const req of t.requires ?? []) {
      const target = byId.get(req.id);
      if (!target || group.has(target.id)) continue;
      group.set(target.id, target);
      reqQueue.push(target);
    }
  }
  // 2) composesWith affinity from every member — skipping foreign apps.
  const queue = [...group.values()].flatMap((t) => t.composesWith);
  while (queue.length) {
    const id = queue.shift()!;
    if (group.has(id)) continue;
    const t = byId.get(id);
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
    const byId = new Map(manifests.map((m) => [m.id, m]));
    for (const app of manifests.filter((m) => m.scope === "app")) {
      const group = compositionGroup(app, byId);
      const result = composeTemplates(group);
      expect(result.ok, `compose(${app.id}): ${result.errors.join("; ")}`).toBe(true);
      expect(result.composition!.scope).toBe("app");
      expect(result.composition!.appTemplateId).toBe(app.id);

      // The additive union rule — EVERY member template's checks survive,
      // keyed `templateId:checkId`. This is the load-bearing invariant.
      const expected = group
        .flatMap((t) => t.checks.map((c) => `${t.id}:${c.id}`))
        .sort();
      const actual = result.composition!.checks
        .map((c) => `${c.templateId}:${c.item.id}`)
        .sort();
      expect(actual).toEqual(expected);
      expect(actual.length).toBeGreaterThan(0);
    }
  });
});
