/**
 * iPhone host acceptance with atomic machine-readable evidence.
 * Config: TEMPLATE_CHECKS_CONFIG.iphoneShell.assertions.
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  runIphoneAssertionCommand,
  validateIphoneCommandPlan,
  type IphoneShellSection,
} from "./iphone-shell-contract.js";

const untilde = (path: string): string =>
  path.startsWith("~/") ? join(homedir(), path.slice(2)) : path;
const configPath = process.env.TEMPLATE_CHECKS_CONFIG;
const config: Record<string, any> | null = configPath
  ? JSON.parse(readFileSync(resolve(untilde(configPath)), "utf8"))
  : null;
const appRoot: string | null = config
  ? resolve(
      dirname(resolve(untilde(configPath!))),
      untilde(config.app?.root ?? "."),
    )
  : null;
const section = config?.iphoneShell as IphoneShellSection | undefined;
const DEFAULT_TIMEOUT_MS = 600_000;
const OUTER_GRACE_MS = 5_000;
const outerTimeout =
  Math.max(
    DEFAULT_TIMEOUT_MS,
    ...(section?.assertions ?? []).map(
      (entry) => entry.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    ),
  ) + OUTER_GRACE_MS;

describe.skipIf(!section)("iphone-shell-assertions", () => {
  it("keeps the outer Vitest budget beyond every child command", () => {
    const largestChild = Math.max(
      DEFAULT_TIMEOUT_MS,
      ...section!.assertions.map(
        (entry) => entry.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      ),
    );
    expect(outerTimeout).toBeGreaterThan(largestChild);
  });

  it("declares the complete required assertion plan", () => {
    expect(validateIphoneCommandPlan(section!)).toEqual([]);
  });

  it.each(section?.assertions ?? [])(
    "$assertionId/$leg",
    (entry) => {
      const result = runIphoneAssertionCommand(appRoot!, section!, entry);
      expect(
        result.evidence.verdict,
        `${result.evidence.identity}: ${result.evidence.verdict}\nevidence: ${result.evidencePath}\n${result.output}`,
      ).toBe("pass");
    },
    outerTimeout,
  );
});
