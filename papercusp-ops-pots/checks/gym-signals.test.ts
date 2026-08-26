/**
 * gym-signals — the stable app agent's guardrail signals are present and wired.
 * (papercusp-ops-pots template check; plan app-templates-2026-07-04 P-007.)
 *
 * PORTABLE + APP-PARAMETERIZED: copied verbatim into a composed app, driven by
 * the TEMPLATE_CHECKS_CONFIG JSON (schema: @papercusp/template-kit
 * `TemplateChecksConfig`, section `gym`). Skips without the env var. Needs
 * only `vitest` + `yaml` devDeps.
 *
 * Config section:
 *   gym: {
 *     blueprint: string           // stable app-agent blueprint, app-root-relative
 *     requiredSignals: string[]   // the app's ids for the four signal classes:
 *                                 //   no-<danger>-reach, <workUnit>-has-evidence,
 *                                 //   <constraint>-honored, schema-clean-output
 *   }
 *
 * Asserts the app-agent blueprint declares a gym block with a collectTrace mode
 * and a signals list covering every required id — the un-gameable guardrails
 * the agent is scored + self-improved against. (consumer #1's exemplar set:
 * no-checkout-reach, candidate-has-evidence, price-ceiling-honored,
 * schema-clean-output.)
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

const section = config?.gym as { blueprint: string; requiredSignals: string[] } | undefined;

describe.skipIf(!section)("gym-signals", () => {
  const doc = () =>
    parse(readFileSync(inApp(section!.blueprint), "utf8")) as {
      gym?: { collectTrace?: unknown; signals?: unknown };
    };

  it("config requires at least one signal id", () => {
    expect(section!.requiredSignals.length).toBeGreaterThan(0);
  });

  it("the stable app-agent blueprint declares a gym block with a collectTrace mode", () => {
    const gym = doc().gym;
    expect(gym, `${section!.blueprint}: no gym: block`).toBeTruthy();
    expect(typeof gym!.collectTrace, `${section!.blueprint}: gym.collectTrace missing`).toBe("string");
    expect((gym!.collectTrace as string).length).toBeGreaterThan(0);
  });

  it("every required guardrail signal is declared", () => {
    const declared = doc().gym?.signals;
    expect(Array.isArray(declared), `${section!.blueprint}: gym.signals is not a list`).toBe(true);
    const missing = section!.requiredSignals.filter((s) => !(declared as string[]).includes(s));
    expect(missing, `missing gym signals: ${missing.join(", ")}`).toEqual([]);
  });
});
