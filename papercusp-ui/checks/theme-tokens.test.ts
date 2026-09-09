/**
 * theme-tokens — the composed app consumes the papercusp-ui shared theme
 * token package (D-011, plan unified-web-portal-2026-08-29): a generated
 * tokens.css carrying the 3-state light/dark/system model, and NO raw hex
 * colors in app CSS outside it (raw-hex leakage is the real dark-mode
 * blocker — every color routes through the semantic vars).
 *
 * PORTABLE + APP-PARAMETERIZED: copied verbatim into a composed app, driven by
 * the TEMPLATE_CHECKS_CONFIG JSON (schema: @papercusp/template-kit
 * `TemplateChecksConfig`, section `themeTokens`). Skips without the env var.
 * Needs only `vitest` devDep.
 *
 * Config section:
 *   themeTokens: {
 *     tokensCss: string   // app-root-relative path to the GENERATED tokens.css
 *                         //   (e.g. "app/tokens.css")
 *     appCss: string[]    // app CSS files that must be raw-hex-free
 *                         //   (the generated tokens.css itself is exempt)
 *   }
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

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

const section = config?.themeTokens as { tokensCss: string; appCss: string[] } | undefined;

/** Vars every app-family surface draws from — present in light AND dark. */
const CANONICAL_VARS = ["--paper", "--ink", "--muted", "--line", "--panel", "--accent", "--danger"];

const RAW_HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g;

const stripComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * Raw hex is permitted ONLY inside custom-property DEFINITIONS (`--x: …;`) —
 * that is the D-011 per-app override layer (a calendar's `--today`, a distinct
 * `--accent`), which defines the var for both modes and is theme-correct by
 * construction. Hex in a USAGE position (background/color/border/shadow
 * values) is the dark-flip hazard this check exists to catch.
 */
const stripCustomPropertyDefinitions = (line: string): string =>
  line.replace(/--[A-Za-z0-9-]+\s*:\s*[^;{}]*/g, "");

describe.skipIf(!section)("theme-tokens", () => {
  it("the generated tokens.css carries the 3-state light/dark/system model", () => {
    const css = readFileSync(inApp(section!.tokensCss), "utf8");
    // Explicit dark, and system-dark guarded so an explicit light choice wins.
    expect(css, "explicit-dark block").toContain(':root[data-theme="dark"]');
    expect(css, "system-dark media query").toContain("@media (prefers-color-scheme: dark)");
    expect(css, "system-dark must not override an explicit light choice").toContain(':not([data-theme="light"])');
    expect(css, "light color-scheme").toContain("color-scheme: light");
    expect(css, "dark color-scheme").toContain("color-scheme: dark");
    for (const v of CANONICAL_VARS) {
      const defs = css.split(`${v}:`).length - 1;
      expect(defs, `${v} must be defined in light AND dark (found ${defs} definitions)`).toBeGreaterThanOrEqual(2);
    }
  });

  it("app CSS contains no raw hex colors in usage positions — every color routes through the semantic vars", () => {
    const offenders: string[] = [];
    for (const rel of section!.appCss) {
      const path = inApp(rel);
      const lines = stripComments(readFileSync(path, "utf8")).split("\n");
      lines.forEach((line, i) => {
        const hits = stripCustomPropertyDefinitions(line).match(RAW_HEX);
        if (hits) offenders.push(`${rel}:${i + 1}: ${hits.join(" ")}`);
      });
    }
    expect(
      offenders,
      `raw hex in app CSS — replace with var(--…) from tokens.css (add a semantic token if none fits):\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
