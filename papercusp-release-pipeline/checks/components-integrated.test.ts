/**
 * components-integrated — the composed app actually DEPENDS on this
 * template's pinned component packages.
 * (papercusp-data-sync template check; plan app-templates-2026-07-04 P-017.)
 *
 * PORTABLE + APP-PARAMETERIZED: copied verbatim into a composed app, driven by
 * the TEMPLATE_CHECKS_CONFIG JSON (schema: @papercusp/template-kit
 * `TemplateChecksConfig`, section `components`). Skips without the env var.
 * Needs only `vitest` devDep.
 *
 * Config section:
 *   components: {
 *     packages: string[]     // npm package names the app must declare
 *                            //   (e.g. "@papercusp/sync", "@papercusp/sse")
 *     manifests?: string[]   // package.json paths to search, app-root-relative
 *                            //   (default: ["package.json"])
 *   }
 *
 * Asserts every listed package appears in dependencies/devDependencies of at
 * least one of the app's manifests — a template composed "on paper" whose
 * components were never actually wired in fails HERE, before any deeper check.
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

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

const section = config?.components as { packages: string[]; manifests?: string[] } | undefined;

describe.skipIf(!section)("components-integrated", () => {
  it("every pinned component package is a declared dependency of the app", () => {
    const manifests = (section!.manifests ?? ["package.json"]).map(inApp);
    const declared = new Set<string>();
    for (const m of manifests) {
      const pkg = JSON.parse(readFileSync(m, "utf8")) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      for (const name of Object.keys(pkg.dependencies ?? {})) declared.add(name);
      for (const name of Object.keys(pkg.devDependencies ?? {})) declared.add(name);
    }
    const missing = section!.packages.filter((p) => !declared.has(p));
    expect(missing, `undeclared component packages: ${missing.join(", ")} (searched: ${manifests.join(", ")})`).toEqual([]);
  });
});
