/**
 * Portable shared-mobile scaffold and source-hygiene acceptance.
 * Config: TEMPLATE_CHECKS_CONFIG.mobileBase (see checks/README.md).
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  collectMobileSourceViolations,
  validateMobileScaffold,
  type MobileBaseStaticSection,
} from "./mobile-base-contract.js";

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
const section = config?.mobileBase as MobileBaseStaticSection | undefined;

describe.skipIf(!section)("mobile-base-contract", () => {
  it("declares the frozen three-crate Rust/UniFFI/token scaffold", () => {
    expect(validateMobileScaffold(appRoot!, section!)).toEqual([]);
  });

  it("contains no unallowlisted identity placeholder, secret path, or credential signature", () => {
    expect(collectMobileSourceViolations(appRoot!, section!)).toEqual([]);
  });
});
