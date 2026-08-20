/**
 * Portable Android source/chassis acceptance.
 * Config: TEMPLATE_CHECKS_CONFIG.androidShell (see checks/README.md).
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  validateAndroidCommandPlan,
  validateAndroidShellScaffold,
  type AndroidShellSection,
} from "./android-shell-contract.js";

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
const section = config?.androidShell as AndroidShellSection | undefined;

describe.skipIf(!section)("android-shell-contract", () => {
  it("pins the source chassis, identity, generated boundary, privacy, tests, and release inputs", () => {
    expect(validateAndroidShellScaffold(appRoot!, section!)).toEqual([]);
  });

  it("covers every required MOB-AND host leg exactly once", () => {
    expect(validateAndroidCommandPlan(section!)).toEqual([]);
  });
});
