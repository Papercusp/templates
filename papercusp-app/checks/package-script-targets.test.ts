import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const TEST_SCRIPT_NAME = /(^|[-_:])(test|tests|e2e|spec|check)(?:$|[-_:])/i;
const TEST_FILE_TOKEN = /(?:^|[\s"'`])((?:\.{1,2}\/|\/)?[\w@./-]+\.(?:test|spec)\.[cm]?[jt]sx?)(?=$|[\s"'`])/g;

function expandHome(path: string): string {
  return path.startsWith("~/") ? join(homedir(), path.slice(2)) : path;
}

function configuredAppRoot(configFile: string): string {
  const resolvedConfig = resolve(expandHome(configFile));
  const config = JSON.parse(readFileSync(resolvedConfig, "utf8")) as { app?: { root?: string } };
  return resolve(dirname(resolvedConfig), expandHome(config.app?.root ?? "."));
}

function explicitTestFiles(command: string): string[] {
  return [...command.matchAll(TEST_FILE_TOKEN)]
    .map((match) => match[1]!)
    // Vitest accepts globs; they describe a pattern, not one required file.
    .filter((path) => !/[*!?{}]/.test(path));
}

function missingTestTargets(scripts: Record<string, unknown>, appRoot: string): string[] {
  const missing: string[] = [];
  for (const [name, command] of Object.entries(scripts)) {
    if (typeof command !== "string" || !TEST_SCRIPT_NAME.test(name)) continue;
    for (const target of explicitTestFiles(command)) {
      if (!existsSync(resolve(appRoot, target))) missing.push(`${name} -> ${target}`);
    }
  }
  return missing;
}

describe("package test script targets", () => {
  it.skipIf(!process.env.TEMPLATE_CHECKS_CONFIG)("every explicit test file path in a test/check script exists", () => {
    const appRoot = configuredAppRoot(process.env.TEMPLATE_CHECKS_CONFIG!);
    const manifest = JSON.parse(readFileSync(join(appRoot, "package.json"), "utf8")) as {
      scripts?: Record<string, unknown>;
    };
    const missing = missingTestTargets(manifest.scripts ?? {}, appRoot);
    expect(missing, `Missing test targets in ${join(appRoot, "package.json")}`).toEqual([]);
  });

  it("detects a missing named test file while allowing Vitest globs", () => {
    const missing = missingTestTargets({
      "test:e2e:web": "vitest run tests/missing.e2e.test.ts",
      "test:unit": "vitest run tests/*.test.ts",
      build: "node tests/also-missing.test.ts",
    }, process.cwd());
    expect(missing).toEqual(["test:e2e:web -> tests/missing.e2e.test.ts"]);
  });
});
