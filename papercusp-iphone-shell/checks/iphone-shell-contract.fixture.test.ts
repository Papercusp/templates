import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { platform, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  REQUIRED_IPHONE_ASSERTION_LEGS,
  runIphoneAssertionCommand,
  validateIphoneCommandPlan,
  validateIphoneShellConfig,
  validateIphoneShellScaffold,
  type IphoneAssertionCommand,
  type IphoneShellSection,
} from "./iphone-shell-contract.js";

const roots: string[] = [];
afterEach(() => {
  while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true });
});

function put(root: string, path: string, content = "fixture\n"): void {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}

const signingPrefix = "HARBOR_IOS_RELEASE_";
const signingInputNames = [
  `${signingPrefix}TEAM_ID`,
  `${signingPrefix}CODE_SIGN_IDENTITY`,
  `${signingPrefix}PROVISIONING_PROFILE`,
];

function assertionPlan(): IphoneAssertionCommand[] {
  return REQUIRED_IPHONE_ASSERTION_LEGS.map(([assertionId, leg]) => {
    if (leg === "signing-absence") {
      return {
        assertionId,
        leg,
        command: [
          process.execPath,
          "-e",
          "console.error('missing signing identity'); process.exit(9)",
        ],
        unsetEnv: [...signingInputNames],
        expectedExit: "nonzero" as const,
        expectedOutputPattern: "missing signing identity",
      };
    }
    if (leg === "unit" || leg === "ui") {
      return {
        assertionId,
        leg,
        command: [
          process.execPath,
          "-e",
          "console.log('Executed 3 tests'); process.exit(0)",
        ],
        expectedOutputPattern: "Executed [1-9][0-9]* tests",
      };
    }
    return {
      assertionId,
      leg,
      command: [process.execPath, "-e", "process.exit(0)"],
    };
  });
}

function fixture(): { root: string; section: IphoneShellSection } {
  const root = mkdtempSync(join(tmpdir(), "papercusp-iphone-shell-"));
  roots.push(root);
  const paths: IphoneShellSection["paths"] = {
    projectSpec: "ios/project.yml",
    generatedProject: "ios/Harbor.xcodeproj",
    gitignore: ".gitignore",
    infoPlist: "ios/Harbor/Info.plist",
    privacyManifest: "ios/Harbor/Resources/PrivacyInfo.xcprivacy",
    entitlements: "ios/Harbor/Harbor.entitlements",
    appSourceRoot: "ios/Harbor/Sources",
    coreSourceRoot: "ios/HarborCore",
    unitTestRoots: ["ios/HarborTests"],
    uiTestRoots: ["ios/HarborUITests"],
    buildScript: "tools/build-ios.sh",
    hostPreflightScript: "tools/check-ios-host.sh",
    testScript: "tools/run-ios-tests.sh",
    releaseScript: "tools/ios-release-preflight.sh",
    udl: "crates/harbor_bindings/src/harbor.udl",
    uniffiConfig: "crates/harbor_bindings/uniffi.toml",
    cargoLock: "Cargo.lock",
    generatedSwift: "ios/HarborCore/harbor.swift",
    ffiHeader: "ios/HarborCore/harborFFI.h",
    moduleMap: "ios/HarborCore/headers/module.modulemap",
    deviceLibrary: "target/aarch64-apple-ios/release/libharbor.a",
    simulatorLibrary: "ios/build/libharbor-simulator.a",
    xcframework: "ios/HarborCore.xcframework",
    archive: "ios/build/Harbor.xcarchive",
    exportDir: "ios/build/export",
    provenanceFile: "ios/build/ios-release-provenance.json",
  };

  put(
    root,
    paths.projectSpec,
    `name: Harbor
options:
  deploymentTarget:
    iOS: "17.0"
settings:
  base:
    SWIFT_VERSION: "5.9"
    IPHONEOS_DEPLOYMENT_TARGET: "17.0"
targets:
  HarborCore:
    type: framework
    platform: iOS
    sources:
      - path: HarborCore
      - path: HarborCore/harbor.swift
    dependencies:
      - framework: HarborCore.xcframework
  Harbor:
    type: application
    platform: iOS
    sources:
      - path: Harbor/Sources
      - path: Harbor/Resources
    dependencies:
      - target: HarborCore
    settings:
      base:
        PRODUCT_BUNDLE_IDENTIFIER: dev.harbor.mobile
        INFOPLIST_FILE: Harbor/Info.plist
        CODE_SIGN_ENTITLEMENTS: Harbor/Harbor.entitlements
  HarborTests:
    type: bundle.unit-test
    platform: iOS
    sources:
      - path: HarborTests
    dependencies:
      - target: Harbor
  HarborUITests:
    type: bundle.ui-testing
    platform: iOS
    sources:
      - path: HarborUITests
    dependencies:
      - target: Harbor
schemes:
  Harbor:
    test:
      targets:
        - HarborTests
        - HarborUITests
`,
  );
  put(
    root,
    paths.gitignore,
    "ios/Harbor.xcodeproj\nios/build\nios/*.xcframework\n",
  );
  put(
    root,
    paths.infoPlist,
    `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict>
<key>CFBundleDisplayName</key><string>Harbor</string>
</dict></plist>
`,
  );
  put(
    root,
    paths.privacyManifest,
    `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict>
<key>NSPrivacyTracking</key><false/>
<key>NSPrivacyTrackingDomains</key><array/>
<key>NSPrivacyCollectedDataTypes</key><array/>
<key>NSPrivacyAccessedAPITypes</key><array/>
</dict></plist>
`,
  );
  put(
    root,
    paths.entitlements,
    `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict></dict></plist>
`,
  );
  put(root, `${paths.appSourceRoot}/HarborApp.swift`, "import SwiftUI\n");
  put(root, `${paths.coreSourceRoot}/.gitkeep`, "");
  put(root, `${paths.unitTestRoots[0]}/SmokeTests.swift`, "import XCTest\n");
  put(root, `${paths.uiTestRoots[0]}/LaunchTests.swift`, "import XCTest\n");
  put(
    root,
    paths.udl,
    "namespace harbor {};\ninterface Harbor { string ping(); };\n",
  );
  put(root, paths.uniffiConfig, "[bindings.swift]\n");
  put(root, paths.cargoLock, "# lock\n");
  put(
    root,
    paths.buildScript,
    `#!/usr/bin/env bash
rm -rf ${paths.xcframework} ${paths.simulatorLibrary}
cargo build --release --target aarch64-apple-ios
cargo build --release --target aarch64-apple-ios-sim
cargo build --release --target x86_64-apple-ios
cargo run --bin uniffi-bindgen -- generate ${paths.udl} --config ${paths.uniffiConfig} --out-dir ${paths.coreSourceRoot}
test -f ${paths.cargoLock}
test -f ${paths.generatedSwift}
test -f ${paths.ffiHeader}
mkdir -p ios/HarborCore/headers
mv ios/HarborCore/harborFFI.modulemap ${paths.moduleMap}
lipo -create target/aarch64-apple-ios-sim/release/libharbor.a target/x86_64-apple-ios/release/libharbor.a -output ${paths.simulatorLibrary}
xcodebuild -create-xcframework -library ${paths.deviceLibrary} -headers ios/HarborCore/headers -library ${paths.simulatorLibrary} -headers ios/HarborCore/headers -output ${paths.xcframework}
`,
  );
  put(
    root,
    paths.hostPreflightScript,
    `#!/usr/bin/env bash
# remote executor alias: fixture-mac
test "$(uname -s)" = Darwin
command -v xcodebuild
command -v xcodegen
command -v swiftformat
xcrun simctl list devices available
`,
  );
  put(
    root,
    paths.testScript,
    `#!/usr/bin/env bash
xcrun simctl boot fixture-udid || true
for attempt in $(seq 1 60); do
  xcrun simctl spawn fixture-udid launchctl print system >/dev/null 2>&1 && break
  sleep 1
done
xcodebuild build-for-testing -scheme Harbor -resultBundlePath ios/build/build.xcresult
xcodebuild test-without-building -scheme Harbor -resultBundlePath ios/build/test.xcresult
xcrun xcresulttool get test-results tests --path ios/build/test.xcresult > ios/build/tests.json
testsCount=$({ grep -o '"nodeIdentifier"' ios/build/tests.json || true; } | wc -l | tr -d ' ')
test "$testsCount" -gt 0
echo "Executed $testsCount tests"
`,
  );
  put(
    root,
    paths.releaseScript,
    `#!/usr/bin/env bash
team="\${HARBOR_IOS_RELEASE_TEAM_ID:?}"
identity="\${HARBOR_IOS_RELEASE_CODE_SIGN_IDENTITY:?}"
profile="\${HARBOR_IOS_RELEASE_PROVISIONING_PROFILE:?}"
version="\${HARBOR_IOS_RELEASE_VERSION:?}"
build="\${HARBOR_IOS_BUILD_NUMBER:?}"
method=development
git status --porcelain
xcodebuild archive -scheme Harbor -archivePath ${paths.archive} DEVELOPMENT_TEAM="$team" CODE_SIGN_IDENTITY="$identity" PROVISIONING_PROFILE_SPECIFIER="$profile"
xcodebuild -exportArchive -archivePath ${paths.archive} -exportPath ${paths.exportDir}
sha256sum ${paths.exportDir}/Harbor.ipa > ${paths.provenanceFile}.tmp
printf '%s %s %s\n' "$version" "$build" "$method" >> ${paths.provenanceFile}.tmp
mv ${paths.provenanceFile}.tmp ${paths.provenanceFile}
`,
  );

  return {
    root,
    section: {
      bundleId: "dev.harbor.mobile",
      productName: "Harbor",
      coreModule: "HarborCore",
      scheme: "Harbor",
      projectName: "Harbor",
      deploymentTarget: "17.0",
      swiftVersion: "5.9",
      deviceTarget: "aarch64-apple-ios",
      simulatorTargets: ["aarch64-apple-ios-sim", "x86_64-apple-ios"],
      rustLibrary: "libharbor.a",
      ffiModule: "harborFFI",
      hostStrategy: "remote-host",
      remoteHost: "fixture-mac",
      releaseVersionInput: "HARBOR_IOS_RELEASE_VERSION",
      buildNumberInput: "HARBOR_IOS_BUILD_NUMBER",
      signingPrefix,
      signingInputNames: [...signingInputNames],
      exportMethod: "development",
      selectedCapabilities: [],
      entitlementKeys: [],
      privacyUsageDescriptionKeys: [],
      backgroundModes: [],
      paths,
      evidenceDir: "ios/build/template-checks/iphone-shell",
      assertions: assertionPlan(),
    },
  };
}

describe("portable iPhone shell contract logic", () => {
  it("accepts a neutral XcodeGen/XCFramework shell and complete host plan", () => {
    const { root, section } = fixture();
    expect(validateIphoneShellConfig(section)).toEqual([]);
    expect(validateIphoneShellScaffold(root, section)).toEqual([]);
    expect(validateIphoneCommandPlan(section)).toEqual([]);
  });

  it("catches project-source, generated-module, and Rust-slice drift", () => {
    const { root, section } = fixture();
    put(
      root,
      section.paths.projectSpec,
      `name: Wrong
options:
  deploymentTarget:
    iOS: "16.0"
targets:
  Harbor:
    type: application
    sources:
      - path: Harbor/Sources
      - path: HarborCore/harbor.swift
`,
    );
    const build = readFileSync(join(root, section.paths.buildScript), "utf8")
      .replaceAll("aarch64-apple-ios-sim", "arm64-simulator-missing")
      .replace("xcodebuild -create-xcframework", "echo omitted");
    put(root, section.paths.buildScript, build);
    const errors = validateIphoneShellScaffold(root, section).join("\n");
    expect(errors).toContain("name: Harbor");
    expect(errors).toContain("missing generated boundary target HarborCore");
    expect(errors).toContain(
      "app target may not compile generated Swift directly",
    );
    expect(errors).toContain("aarch64-apple-ios-sim");
    expect(errors).toContain("-create-xcframework");
  });

  it("rejects capability/privacy drift, literal signing, and upload commands", () => {
    const { root, section } = fixture();
    section.selectedCapabilities = ["camera", "push"];
    const project = readFileSync(join(root, section.paths.projectSpec), "utf8");
    put(
      root,
      section.paths.projectSpec,
      `${project}\nsettings:\n  DEVELOPMENT_TEAM: ABCDE12345\n`,
    );
    const release = readFileSync(
      join(root, section.paths.releaseScript),
      "utf8",
    );
    put(
      root,
      section.paths.releaseScript,
      `${release}\nxcrun altool --upload-app\n`,
    );
    const errors = validateIphoneShellScaffold(root, section).join("\n");
    expect(errors).toContain("push requires aps-environment entitlement");
    expect(errors).toContain("camera requires NSCameraUsageDescription");
    expect(errors).toContain("literal Apple development team id");
    expect(errors).toContain("upload invocation is forbidden");
  });

  it("rejects an incomplete or vacuously passing command plan", () => {
    const { section } = fixture();
    section.assertions = section.assertions.filter(
      (entry) => entry.leg !== "ui",
    );
    const unit = section.assertions.find((entry) => entry.leg === "unit")!;
    delete unit.expectedOutputPattern;
    const signing = section.assertions.find(
      (entry) => entry.leg === "signing-absence",
    )!;
    signing.expectedExit = "zero";
    signing.unsetEnv = [];
    const errors = validateIphoneCommandPlan(section).join("\n");
    expect(errors).toContain("MOB-IOS-005/ui");
    expect(errors).toContain(
      "unit must declare a non-zero test-count output pattern",
    );
    expect(errors).toContain("signing-absence must expect nonzero");
    expect(errors).toContain(
      `signing-absence must unset ${signingInputNames[0]}`,
    );
  });

  it("rejects GUI-dependent remote simulator readiness", () => {
    const { root, section } = fixture();
    const script = readFileSync(join(root, section.paths.testScript), "utf8")
      .replace(
        "xcrun simctl spawn fixture-udid launchctl print system >/dev/null 2>&1 && break",
        "xcrun simctl bootstatus fixture-udid -b",
      );
    put(root, section.paths.testScript, script);
    const errors = validateIphoneShellScaffold(root, section).join("\n");
    expect(errors).toContain("bounded headless simulator readiness");
    expect(errors).toContain("may not use GUI-dependent simctl bootstatus");
  });

  it("rejects an obsolete xcresult test-count key", () => {
    const { root, section } = fixture();
    const script = readFileSync(join(root, section.paths.testScript), "utf8")
      .replace("nodeIdentifier", "testIdentifier");
    put(root, section.paths.testScript, script);
    expect(validateIphoneShellScaffold(root, section).join("\n")).toContain(
      "missing 'nodeIdentifier'",
    );
  });

  it("writes atomic evidence for pass, expected failure, and Linux host constraint", () => {
    const { root, section } = fixture();
    const pass = runIphoneAssertionCommand(root, section, {
      assertionId: "MOB-IOS-005",
      leg: "unit",
      command: [process.execPath, "-e", "console.log('Executed 2 tests')"],
      expectedOutputPattern: "Executed [1-9][0-9]* tests",
    });
    expect(pass.evidence.verdict).toBe("pass");
    expect(existsSync(pass.evidencePath)).toBe(true);

    const negative = runIphoneAssertionCommand(root, section, {
      assertionId: "MOB-IOS-006",
      leg: "signing-absence",
      command: [
        process.execPath,
        "-e",
        "console.error('signing missing'); process.exit(4)",
      ],
      expectedExit: "nonzero",
      expectedOutputPattern: "signing missing",
    });
    expect(negative.evidence.verdict).toBe("pass");

    const local = runIphoneAssertionCommand(
      root,
      { ...section, hostStrategy: "local-mac", remoteHost: undefined },
      {
        assertionId: "MOB-IOS-004",
        leg: "host-preflight",
        command: [process.execPath, "-e", "process.exit(0)"],
      },
    );
    expect(local.evidence.verdict).toBe(
      platform() === "darwin" ? "pass" : "host-constrained",
    );
    expect(JSON.parse(readFileSync(local.evidencePath, "utf8")).verdict).toBe(
      local.evidence.verdict,
    );
  });
});
