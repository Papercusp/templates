import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  collectMobileSourceViolations,
  validateMobileScaffold,
  type MobileBaseStaticSection,
} from "./mobile-base-contract.js";

const roots: string[] = [];
afterEach(() => {
  while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true });
});

function put(root: string, path: string, content = "fixture\n"): void {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}

function fixture(extraSource = "export const appName = 'Harbor';\n"): {
  root: string;
  section: MobileBaseStaticSection;
} {
  const root = mkdtempSync(join(tmpdir(), "papercusp-mobile-base-"));
  roots.push(root);
  put(
    root,
    "Cargo.toml",
    '[workspace]\nresolver = "2"\nmembers = ["crates/*"]\n[workspace.package]\nrust-version = "1.88"\n',
  );
  put(root, "Cargo.lock");
  for (const name of ["harbor_core", "harbor_bindings", "harbor_cli"]) {
    put(
      root,
      `crates/${name}/Cargo.toml`,
      `[package]\nname = "${name}"\nversion = "0.1.0"\n`,
    );
  }
  put(root, "crates/harbor_core/src/lib.rs", extraSource);
  put(
    root,
    "crates/harbor_bindings/src/harbor.udl",
    "namespace harbor {};\ninterface Harbor { string ping(); };\n",
  );
  put(
    root,
    "crates/harbor_bindings/uniffi.toml",
    "[bindings.kotlin]\n[bindings.swift]\n",
  );
  put(root, "crates/harbor_bindings/src/bin/uniffi-bindgen.rs");
  put(
    root,
    "design/mobile-tokens.json",
    '{"primitive":{"color":{"ink":"#000000"}}}\n',
  );
  put(root, "android/app/src/main/java/dev/harbor/DesignTokens.kt");
  put(root, "ios/Harbor/DesignTokens.swift");
  put(root, "Makefile");
  return {
    root,
    section: {
      rustMsrv: "1.88",
      rootCargo: "Cargo.toml",
      cargoLock: "Cargo.lock",
      crateManifests: [
        "crates/harbor_core/Cargo.toml",
        "crates/harbor_bindings/Cargo.toml",
        "crates/harbor_cli/Cargo.toml",
      ],
      udl: "crates/harbor_bindings/src/harbor.udl",
      uniffiConfig: "crates/harbor_bindings/uniffi.toml",
      bindgen: "crates/harbor_bindings/src/bin/uniffi-bindgen.rs",
      tokenSource: "design/mobile-tokens.json",
      generatedTokenFiles: [
        "android/app/src/main/java/dev/harbor/DesignTokens.kt",
        "ios/Harbor/DesignTokens.swift",
      ],
      requiredPaths: ["Makefile"],
      scanRoots: ["crates", "android", "ios", "design"],
      forbiddenTokens: ["Papercusp", "SideStage", "com.example", "MobileApp"],
      secretPathPatterns: ["(^|/)release\\.jks$"],
    },
  };
}

describe("portable mobile-base contract logic", () => {
  it("accepts a fully substituted neutral three-crate fixture", () => {
    const { root, section } = fixture();
    expect(validateMobileScaffold(root, section)).toEqual([]);
    expect(collectMobileSourceViolations(root, section)).toEqual([]);
  });

  it("catches foreign product identities, signing files, and credential signatures", () => {
    const { root, section } = fixture(
      "const copiedFrom = 'SideStage';\nconst credential = '-----BEGIN PRIVATE KEY-----';\n",
    );
    put(root, "android/release.jks");
    const violations = collectMobileSourceViolations(root, section).join("\n");
    expect(violations).toContain("forbidden token 'SideStage'");
    expect(violations).toContain("credential signature");
    expect(violations).toContain(
      "android/release.jks: secret/service/signing path",
    );
  });

  it("fails loudly when a substituted scaffold path or MSRV contract drifts", () => {
    const { root, section } = fixture();
    const errors = validateMobileScaffold(root, {
      ...section,
      rustMsrv: "1.90",
      udl: "crates/harbor_bindings/src/missing.udl",
    }).join("\n");
    expect(errors).toContain(
      "missing declared mobile-base path: crates/harbor_bindings/src/missing.udl",
    );
  });

  it("scans Git-visible source without treating ignored local inputs as committed secrets", () => {
    const { root, section } = fixture();
    execFileSync("git", ["init", "-q", root]);
    put(
      root,
      ".gitignore",
      "android/local.properties\nandroid/app/google-services.json\n",
    );
    put(root, "android/local.properties", "sdk.dir=/private/android-sdk\n");
    put(root, "android/app/google-services.json", '{"project_id":"local"}\n');

    expect(collectMobileSourceViolations(root, section)).toEqual([]);

    put(root, "android/release.jks", "unignored signing fixture\n");
    expect(collectMobileSourceViolations(root, section)).toContain(
      "android/release.jks: secret/service/signing path",
    );
  });
});
