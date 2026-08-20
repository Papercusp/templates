/**
 * Portable iPhone source/chassis acceptance.
 * Config: TEMPLATE_CHECKS_CONFIG.iphoneShell (see checks/README.md).
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  validateIphoneCommandPlan,
  validateIphoneShellScaffold,
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

describe.skipIf(!section)("iphone-shell-contract", () => {
  it("pins the XcodeGen chassis, generated module, privacy, host, tests, and release preflight", () => {
    expect(validateIphoneShellScaffold(appRoot!, section!)).toEqual([]);
  });

  it("covers every required MOB-IOS host leg exactly once", () => {
    expect(validateIphoneCommandPlan(section!)).toEqual([]);
  });
});
