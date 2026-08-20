import {
  parseTemplateManifest,
  type TemplateManifest,
} from "@papercusp/template-kit";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import {
  expectedDecisionPointAnswerKeys,
  validateAndroidAppComposition,
  validateDecisionPointAnswers,
} from "./android-app-contract.js";

const here = dirname(fileURLToPath(import.meta.url));
const manifests: TemplateManifest[] = [
  join(here, "../template.yaml"),
  join(here, "../../papercusp-mobile-base/template.yaml"),
  join(here, "../../papercusp-android-shell/template.yaml"),
].map((path) => parseTemplateManifest(parse(readFileSync(path, "utf8"))));
const reference = JSON.parse(
  readFileSync(
    join(here, "../reference/android-app.checks-config.example.json"),
    "utf8",
  ),
) as { composition: { decisionPointAnswers: Record<string, string> } };

describe("papercusp-android-app contract fixtures", () => {
  it("the canonical three-template closure composes", () => {
    expect(validateAndroidAppComposition(manifests)).toEqual([]);
  });

  it("the neutral reference answers every tagged closure decision", () => {
    expect(expectedDecisionPointAnswerKeys(manifests)).toHaveLength(12);
    expect(
      validateDecisionPointAnswers(
        manifests,
        reference.composition.decisionPointAnswers,
      ),
    ).toEqual([]);
  });

  it("rejects a missing answer and an unknown answer key", () => {
    const answers: Record<string, string> = {
      ...reference.composition.decisionPointAnswers,
      "foreign-template:unknown": "must not be accepted",
    };
    delete answers["papercusp-android-shell:android-release"];
    expect(validateDecisionPointAnswers(manifests, answers)).toEqual([
      "composition.decisionPointAnswers.papercusp-android-shell:android-release: required non-empty answer",
      "composition.decisionPointAnswers.foreign-template:unknown: unknown decision point",
    ]);
  });

  it("rejects a substituted or incomplete dependency closure", () => {
    expect(validateAndroidAppComposition(manifests.slice(0, 2))).toContain(
      "composition.templateYamls: must resolve exactly papercusp-android-app, papercusp-mobile-base, papercusp-android-shell",
    );
  });
});
