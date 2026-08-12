/**
 * confinement-guard — no hive role holds a cart/checkout/vault/approvals-write
 * analog capability. (papercusp-ops-pots template check; plan
 * app-templates-2026-07-04 P-007.)
 *
 * PORTABLE + APP-PARAMETERIZED: this file is copied verbatim into a composed
 * app and driven by a JSON config named via the TEMPLATE_CHECKS_CONFIG env var
 * (schema: @papercusp/template-kit `TemplateChecksConfig`, section
 * `confinement`). Without the env var the suite SKIPS — it never fails a repo
 * that hasn't wired a config. Needs only `vitest` + `yaml` devDeps.
 *
 * Config section:
 *   confinement: {
 *     blueprints: string[]          // blueprint.yaml paths, app-root-relative
 *     dangerousCapabilities: string[] // patterns: exact ("approvals:write")
 *                                     //        or resource-wide ("cart:*")
 *     dangerousTools?: string[]     // same pattern language, matched on tools
 *   }
 *
 * The check parses every listed blueprint and asserts NO role's declared
 * `capabilities:` (or `tools:`, when dangerousTools is set) matches a
 * dangerous pattern. This is the static half of the confinement boundary —
 * the enforced half is the install's capability envelopes; the app's
 * blueprints/README.md is the canonical confinement statement.
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
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

const section = config?.confinement as
  | { blueprints: string[]; dangerousCapabilities: string[]; dangerousTools?: string[] }
  | undefined;

/** "cart:*" matches "cart" and any "cart:…"; anything else is an exact match. */
function matchesPattern(value: string, pattern: string): boolean {
  if (pattern.endsWith(":*")) {
    const resource = pattern.slice(0, -2);
    return value === resource || value.startsWith(`${resource}:`);
  }
  return value === pattern;
}

interface BlueprintRole {
  id?: string;
  capabilities?: unknown;
  tools?: unknown;
}

describe.skipIf(!section)("confinement-guard", () => {
  it("config lists at least one blueprint and one dangerous pattern", () => {
    expect(section!.blueprints.length).toBeGreaterThan(0);
    expect(section!.dangerousCapabilities.length).toBeGreaterThan(0);
  });

  it("no hive role holds a dangerous capability (or tool)", () => {
    const violations: string[] = [];
    for (const bpRel of section!.blueprints) {
      const bpPath = inApp(bpRel);
      const doc = parse(readFileSync(bpPath, "utf8")) as { roles?: BlueprintRole[] };
      const roles = Array.isArray(doc.roles) ? doc.roles : [];
      for (const role of roles) {
        const caps = Array.isArray(role.capabilities) ? (role.capabilities as string[]) : [];
        for (const cap of caps) {
          for (const pattern of section!.dangerousCapabilities) {
            if (matchesPattern(cap, pattern)) {
              violations.push(`${bpRel} role '${role.id ?? "?"}' capability '${cap}' matches dangerous '${pattern}'`);
            }
          }
        }
        const tools = Array.isArray(role.tools) ? (role.tools as string[]) : [];
        for (const tool of tools) {
          for (const pattern of section!.dangerousTools ?? []) {
            if (matchesPattern(tool, pattern)) {
              violations.push(`${bpRel} role '${role.id ?? "?"}' tool '${tool}' matches dangerous '${pattern}'`);
            }
          }
        }
      }
    }
    expect(violations, `confinement violations:\n  ${violations.join("\n  ")}`).toEqual([]);
  });

  it("every listed blueprint declares at least one role somewhere in the set", () => {
    // Sanity against a config typo pointing at empty/wrong files: the SET must
    // contain roles, else the guard above passed vacuously.
    const roleCount = section!.blueprints
      .map((bpRel) => parse(readFileSync(inApp(bpRel), "utf8")) as { roles?: BlueprintRole[] })
      .reduce((n, doc) => n + (Array.isArray(doc.roles) ? doc.roles.length : 0), 0);
    expect(roleCount, "no roles found in any listed blueprint — is the config pointing at the right files?").toBeGreaterThan(0);
  });
});
