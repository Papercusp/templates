import { type TemplateManifest } from "@papercusp/template-kit";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { resolveSiblingClosure } from "./closure-manifests.js";
import {
  expectedDecisionPointAnswerKeys,
  validateDecisionPointAnswers,
  validateIphoneAppComposition,
} from "./iphone-app-contract.js";

const here = dirname(fileURLToPath(import.meta.url));

// This fixture suite validates the REPO's committed neutral reference record
// against the canonical sibling manifests. A materialized app has neither, so
// the suite skips there instead of failing on an unresolvable sibling path.
const closure = resolveSiblingClosure(join(here, "../template.yaml"), [
  join(here, "../../papercusp-mobile-base/template.yaml"),
  join(here, "../../papercusp-iphone-shell/template.yaml"),
]);
const manifests: TemplateManifest[] = closure.manifests ?? [];
const reference = closure.manifests
  ? (JSON.parse(
      readFileSync(
        join(here, "../reference/iphone-app.checks-config.example.json"),
        "utf8",
      ),
    ) as { composition: { decisionPointAnswers: Record<string, string> } })
  : { composition: { decisionPointAnswers: {} as Record<string, string> } };

describe.skipIf(closure.kind === "materialized")(
  "papercusp-iphone-app contract fixtures",
  () => {
    it("the canonical three-template closure composes", () => {
      expect(validateIphoneAppComposition(manifests)).toEqual([]);
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
      delete answers["papercusp-iphone-shell:iphone-release"];
      expect(validateDecisionPointAnswers(manifests, answers)).toEqual([
        "composition.decisionPointAnswers.papercusp-iphone-shell:iphone-release: required non-empty answer",
        "composition.decisionPointAnswers.foreign-template:unknown: unknown decision point",
      ]);
    });

    it("rejects a placeholder answer that decides nothing", () => {
      // EI-21113490718061966: a non-empty-string rule accepted "unknown" for
      // every decision point, so the answer record read GREEN while nothing
      // was decided. Each of these must be REJECTED.
      for (const placeholder of ["unknown", "TBD", "n/a", "todo", "-", "???"]) {
        const answers: Record<string, string> = {
          ...reference.composition.decisionPointAnswers,
          "papercusp-iphone-shell:iphone-release": placeholder,
        };
        expect(validateDecisionPointAnswers(manifests, answers)).toEqual([
          `composition.decisionPointAnswers.papercusp-iphone-shell:iphone-release: placeholder answer "${placeholder}" does not decide this point`,
        ]);
      }
    });

    it("accepts a short but real answer", () => {
      // Calibration: the placeholder rule must not reject a genuine terse
      // answer, or the case above would pass with a rule that rejects
      // everything.
      const answers: Record<string, string> = {
        ...reference.composition.decisionPointAnswers,
        "papercusp-iphone-shell:iphone-release": "Rust 1.88; no TestFlight.",
      };
      expect(validateDecisionPointAnswers(manifests, answers)).toEqual([]);
    });

    it("rejects a substituted or incomplete dependency closure", () => {
      expect(validateIphoneAppComposition(manifests.slice(0, 2))).toContain(
        "composition.templateYamls: must resolve exactly papercusp-iphone-app, papercusp-mobile-base, papercusp-iphone-shell",
      );
    });
  },
);
