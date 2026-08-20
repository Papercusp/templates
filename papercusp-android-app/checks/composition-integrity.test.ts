/**
 * The thin Android root verifies only exact dependency closure, complete
 * decision answers, and additive composition integrity. Base/shell behavior
 * remains owned by those templates' portable checks.
 */
import {
  parseTemplateManifest,
  type TemplateManifest,
} from "@papercusp/template-kit";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import {
  validateAndroidAppComposition,
  validateDecisionPointAnswers,
} from "./android-app-contract.js";

const untilde = (path: string): string =>
  path.startsWith("~/") ? join(homedir(), path.slice(2)) : path;
const configPath = process.env.TEMPLATE_CHECKS_CONFIG;
const config: Record<string, any> | null = configPath
  ? JSON.parse(readFileSync(resolve(untilde(configPath)), "utf8"))
  : null;
const appRoot = config
  ? resolve(
      dirname(resolve(untilde(configPath!))),
      untilde(config.app?.root ?? "."),
    )
  : null;
const inApp = (path: string): string =>
  isAbsolute(untilde(path)) ? untilde(path) : join(appRoot!, path);

const here = dirname(fileURLToPath(import.meta.url));
const defaultYamlPaths = [
  join(here, "../template.yaml"),
  join(here, "../../papercusp-mobile-base/template.yaml"),
  join(here, "../../papercusp-android-shell/template.yaml"),
];
const configuredYamlPaths = config?.composition?.templateYamls as
  | string[]
  | undefined;
const yamlPaths = configuredYamlPaths?.length
  ? configuredYamlPaths.map(inApp)
  : defaultYamlPaths;
const manifests: TemplateManifest[] = yamlPaths.map((path) =>
  parseTemplateManifest(parse(readFileSync(path, "utf8"))),
);

describe("papercusp-android-app composition-integrity", () => {
  it("resolves exactly the pinned Android root closure and preserves the full check union", () => {
    expect(validateAndroidAppComposition(manifests)).toEqual([]);
  });

  it.skipIf(!config)(
    "records one non-empty tagged answer for every decision point in the closure",
    () => {
      expect(
        validateDecisionPointAnswers(
          manifests,
          config?.composition?.decisionPointAnswers,
        ),
      ).toEqual([]);
    },
  );
});
