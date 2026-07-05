/**
 * Multi-template composition semantics (plan app-templates-2026-07-04 P-014;
 * owner directive: ONE app = a composition of MANY templates).
 *
 * Two distinct validations:
 *
 * - `validateTemplateSet(entries)` — REGISTRY-level anti-rot over the whole
 *   template set (the analog of validateCatalog for components): every entry
 *   parses, ids are unique, and every composesWith reference resolves within
 *   the set. Dangling refs are how a registry rots.
 *
 * - `composeTemplates(templates)` — resolve ONE app's chosen template
 *   selection into a `TemplateComposition`. This is the machine half of the
 *   composition rules the design doc states (§Composition):
 *     · exactly ONE ROOT scope:'app' template per composition (two whole-app
 *       scaffolds cannot both own an app). P-022: an app template MAY require
 *       another app template as its BASE (papercusp-agentic-desktop-app layers the
 *       judgment plane onto papercusp-desktop-app) — a required base app joins the
 *       composition without owning it; only an app no other app in the
 *       selection requires is a root, and there must be exactly one;
 *     · component pins must be CONSISTENT — the same catalog component pinned
 *       at two different versions across the selection is a conflict, never
 *       silently resolved;
 *     · everything composes ADDITIVELY as a tagged union — components are
 *       deduped, while blueprints/contracts/decisionPoints/checks keep their
 *       source template id. **The checks union is the load-bearing rule: an
 *       app built from N templates must pass ALL N templates' checks.**
 *
 * v1 scope (owner decision): schema support + these semantics + manual
 * composition documented in each GUIDE. Automated composition TOOLING (the
 * materializer walking composesWith, prompting per decision point) is v1.1 —
 * this module stays pure so that tooling can sit on top of it unchanged.
 * `composesWith` is a design-affinity declaration, not a dependency edge: a
 * composition may include templates that never name each other.
 */
import type {
  TemplateCheck,
  TemplateComponentRef,
  TemplateDecisionPoint,
  TemplateManifest,
  TemplateScope,
} from "./template-manifest.js";
import { validateTemplateManifest } from "./template-manifest.js";

/** An item of the additive union, tagged with the template that contributed it. */
export interface ComposedFrom<T> {
  templateId: string;
  item: T;
}

/** The resolved result of composing one selection of templates. */
export interface TemplateComposition {
  /** Template ids in the composition, in input order. */
  templateIds: string[];
  /** 'app' when the selection contains an app-scope template, else 'aspect'. */
  scope: TemplateScope;
  /**
   * The ROOT app-scope template when present — the one app no other app in
   * the selection requires (P-022: a required BASE app, e.g. papercusp-desktop-app
   * under papercusp-agentic-desktop-app, is a member but never the owner).
   */
  appTemplateId?: string;
  /** Deduped union of component refs (pins verified consistent across the set). */
  components: TemplateComponentRef[];
  /** Additive union — each entry keeps its source template. */
  blueprints: ComposedFrom<string>[];
  contracts: ComposedFrom<string>[];
  decisionPoints: ComposedFrom<TemplateDecisionPoint>[];
  /**
   * THE union-of-checks: an app built from this composition is done only when
   * every entry here is green. Check ids are unique per-template, not
   * per-composition — key by (templateId, check.id).
   */
  checks: ComposedFrom<TemplateCheck>[];
}

/**
 * Registry-level validation of a whole template set: every entry validates as
 * a TemplateManifest, ids are unique, and every composesWith reference
 * resolves to a template id in the set. Returns EVERY problem.
 *
 * `allowExternalComposesWith` relaxes ONLY the composesWith-resolution leg,
 * for validating a materialized app's CHOSEN subset (WI-2881): composesWith
 * is descriptive affinity — an aspect legitimately names apps the chosen set
 * does not include (e.g. the data/ui aspects name papercusp-tauri-desktop-shell inside
 * a web-only composition). Default STRICT is the registry mode, where a
 * dangling ref is rot (a typo'd or deleted template id must fail loudly).
 * `requires` stays a HARD edge in both modes.
 */
export function validateTemplateSet(
  entries: unknown[],
  opts?: { allowExternalComposesWith?: boolean },
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const ids = new Set<string>();
  const manifests: TemplateManifest[] = [];
  entries.forEach((e, i) => {
    const v = validateTemplateManifest(e);
    if (!v.ok) {
      errors.push(...v.errors.map((msg) => `entry[${i}]: ${msg}`));
      return;
    }
    const m = e as TemplateManifest;
    if (ids.has(m.id)) errors.push(`entry[${i}]: duplicate template id '${m.id}'`);
    ids.add(m.id);
    manifests.push(m);
  });
  const byId = new Map(manifests.map((m) => [m.id, m]));
  for (const m of manifests) {
    if (!opts?.allowExternalComposesWith) {
      for (const ref of m.composesWith) {
        if (!ids.has(ref)) errors.push(`'${m.id}' composesWith unknown template '${ref}'`);
      }
    }
    // requires is a HARD pinned edge (P-015): the target must exist in the set
    // AND its current version must match the pin — a mismatched pin is rot.
    for (const req of m.requires ?? []) {
      const target = byId.get(req.id);
      if (!target) {
        errors.push(`'${m.id}' requires unknown template '${req.id}'`);
      } else if (target.version !== req.version) {
        errors.push(
          `'${m.id}' requires '${req.id}@${req.version}' but the set has ${target.version} (stale pin — update the requirer or the target)`,
        );
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Expand a selection of ROOT templates to its full requires-CLOSURE against a
 * registry (P-015: `requires` is a hard pinned dependency, so composing an
 * app template pulls its requirements in automatically; the checks union then
 * covers the closure). Pure + deterministic: dependencies come before their
 * dependents, each template appears once, root order is otherwise preserved.
 * Errors on an unknown ref, a version-mismatched pin, or a requires cycle.
 */
export function resolveRequiresClosure(
  roots: TemplateManifest[],
  registry: TemplateManifest[],
): { ok: boolean; errors: string[]; templates: TemplateManifest[] } {
  const errors: string[] = [];
  const byId = new Map(registry.map((m) => [m.id, m]));
  for (const r of roots) if (!byId.has(r.id)) byId.set(r.id, r);

  const ordered: TemplateManifest[] = [];
  const done = new Set<string>();
  const inStack = new Set<string>();

  const visit = (m: TemplateManifest, chain: string[]): void => {
    if (done.has(m.id)) return;
    if (inStack.has(m.id)) {
      errors.push(`requires cycle: ${[...chain, m.id].join(" → ")}`);
      return;
    }
    inStack.add(m.id);
    for (const req of m.requires ?? []) {
      const target = byId.get(req.id);
      if (!target) {
        errors.push(`'${m.id}' requires unknown template '${req.id}' (not in the registry)`);
        continue;
      }
      if (target.version !== req.version) {
        errors.push(
          `'${m.id}' requires '${req.id}@${req.version}' but the registry has ${target.version} (stale pin)`,
        );
        continue;
      }
      visit(target, [...chain, m.id]);
    }
    inStack.delete(m.id);
    done.add(m.id);
    ordered.push(m);
  };

  for (const r of roots) visit(r, []);
  return { ok: errors.length === 0, errors, templates: errors.length === 0 ? ordered : [] };
}

/**
 * Resolve one app's template selection into a TemplateComposition.
 * Returns EVERY problem; `composition` is null unless ok.
 */
export function composeTemplates(
  templates: TemplateManifest[],
): { ok: boolean; errors: string[]; composition: TemplateComposition | null } {
  const errors: string[] = [];
  if (templates.length === 0) {
    return { ok: false, errors: ["composition requires at least one template"], composition: null };
  }

  const seen = new Set<string>();
  for (const t of templates) {
    if (seen.has(t.id)) errors.push(`duplicate template '${t.id}' in the composition`);
    seen.add(t.id);
  }

  // P-022: an app template may REQUIRE another app template as its BASE
  // (papercusp-agentic-desktop-app layers onto papercusp-desktop-app). A base app is a member of
  // the composition but never its owner — the single ROOT app (one no other
  // app in the selection requires) owns it. Two independent roots are still
  // the "two whole-app scaffolds cannot both own an app" conflict.
  const appTemplates = templates.filter((t) => t.scope === "app");
  const baseAppIds = new Set<string>();
  for (const t of appTemplates) {
    for (const req of t.requires ?? []) {
      if (appTemplates.some((a) => a.id === req.id)) baseAppIds.add(req.id);
    }
  }
  const rootApps = appTemplates.filter((t) => !baseAppIds.has(t.id));
  if (appTemplates.length > 0 && rootApps.length !== 1) {
    errors.push(
      rootApps.length === 0
        ? `app-scope templates form a requires cycle — no root app among ${appTemplates.map((t) => `'${t.id}'`).join(", ")}`
        : `at most ONE ROOT app-scope template per composition — got ${rootApps.map((t) => `'${t.id}'`).join(", ")} (an app template may only join another's composition as its requires-BASE)`,
    );
  }

  // Closure completeness (P-015): every selected template's `requires` must be
  // satisfied WITHIN the selection, at the pinned version — an app template's
  // hard deps cannot be silently dropped from its composition. (Callers expand
  // a selection first via resolveRequiresClosure.)
  const selected = new Map(templates.map((t) => [t.id, t]));
  for (const t of templates) {
    for (const req of t.requires ?? []) {
      const target = selected.get(req.id);
      if (!target) {
        errors.push(
          `'${t.id}' requires '${req.id}@${req.version}' which is not in the composition — expand via resolveRequiresClosure`,
        );
      } else if (target.version !== req.version) {
        errors.push(
          `'${t.id}' requires '${req.id}@${req.version}' but the composition has ${target.version} (stale pin)`,
        );
      }
    }
  }

  // Component pin consistency: same component id at two versions = conflict.
  const pins = new Map<string, { version: string; templateId: string }>();
  const components: TemplateComponentRef[] = [];
  for (const t of templates) {
    for (const ref of t.components) {
      const prior = pins.get(ref.id);
      if (!prior) {
        pins.set(ref.id, { version: ref.version, templateId: t.id });
        components.push({ id: ref.id, version: ref.version });
      } else if (prior.version !== ref.version) {
        errors.push(
          `component pin conflict on '${ref.id}': '${prior.templateId}' pins ${prior.version}, '${t.id}' pins ${ref.version}`,
        );
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors, composition: null };

  const tag = <T>(templateId: string, items: readonly T[]): ComposedFrom<T>[] =>
    items.map((item) => ({ templateId, item }));

  const composition: TemplateComposition = {
    templateIds: templates.map((t) => t.id),
    scope: appTemplates.length > 0 ? "app" : "aspect",
    ...(appTemplates.length > 0 ? { appTemplateId: rootApps[0]!.id } : {}),
    components,
    blueprints: templates.flatMap((t) => tag(t.id, t.blueprints ?? [])),
    contracts: templates.flatMap((t) => tag(t.id, t.contracts)),
    decisionPoints: templates.flatMap((t) => tag(t.id, t.decisionPoints)),
    checks: templates.flatMap((t) => tag(t.id, t.checks)),
  };
  return { ok: true, errors: [], composition };
}
