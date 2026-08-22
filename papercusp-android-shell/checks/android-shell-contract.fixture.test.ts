import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  REQUIRED_ANDROID_ASSERTION_LEGS,
  runAndroidAssertionCommand,
  validateAndroidCommandPlan,
  validateAndroidShellConfig,
  validateAndroidShellScaffold,
  type AndroidAssertionCommand,
  type AndroidShellSection,
} from "./android-shell-contract.js";

const roots: string[] = [];
afterEach(() => {
  while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true });
});

function put(root: string, path: string, content = "fixture\n"): void {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}

const signingPrefix = "HARBOR_ANDROID_RELEASE_";
const signingInputNames = [
  `${signingPrefix}KEYSTORE`,
  `${signingPrefix}KEYSTORE_PASSWORD`,
  `${signingPrefix}KEY_ALIAS`,
  `${signingPrefix}KEY_PASSWORD`,
];

function assertionPlan(): AndroidAssertionCommand[] {
  return REQUIRED_ANDROID_ASSERTION_LEGS.map(([assertionId, leg]) => {
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
    return {
      assertionId,
      leg,
      command: [process.execPath, "-e", "process.exit(0)"],
    };
  });
}

function fixture(): { root: string; section: AndroidShellSection } {
  const root = mkdtempSync(join(tmpdir(), "papercusp-android-shell-"));
  roots.push(root);
  const paths: AndroidShellSection["paths"] = {
    settingsGradle: "android/settings.gradle.kts",
    projectGradle: "android/build.gradle.kts",
    appGradle: "android/app/build.gradle.kts",
    wrapperProperties: "android/gradle/wrapper/gradle-wrapper.properties",
    manifest: "android/app/src/main/AndroidManifest.xml",
    packageSourceRoot: "android/app/src/main/kotlin/dev/harbor/mobile",
    unitTestRoots: ["android/app/src/test/kotlin"],
    instrumentationTestRoots: ["android/app/src/androidTest/kotlin"],
    lintConfig: "android/app/lint.xml",
    proguardRules: "android/app/proguard-rules.pro",
    buildScript: "tools/build-android.sh",
    abiVerifier: "tools/verify-android-uniffi-abi.sh",
    provenanceScript: "tools/android-release-provenance.sh",
    udl: "crates/harbor_bindings/src/harbor.udl",
    uniffiConfig: "crates/harbor_bindings/uniffi.toml",
    cargoLock: "Cargo.lock",
    generatedKotlin: "android/app/src/main/kotlin/uniffi/harbor/harbor.kt",
    releaseApk: "android/app/build/outputs/apk/release/app-release.apk",
    releaseAab: "android/app/build/outputs/bundle/release/app-release.aab",
    provenanceFile: "android/app/build/outputs/android-release-provenance.json",
  };
  const appGradle = `
val generateUniFfiKotlin by tasks.registering(Exec::class) {
  inputs.file(repositoryRoot.resolve("${paths.udl}"))
  inputs.file(repositoryRoot.resolve("${paths.uniffiConfig}"))
  inputs.file(repositoryRoot.resolve("${paths.cargoLock}"))
  outputs.file(repositoryRoot.resolve("${paths.generatedKotlin}"))
}
android {
  namespace = "dev.harbor.mobile"
  compileSdk = 36
  defaultConfig {
    applicationId = "dev.harbor.mobile"
    minSdk = 24
    targetSdk = 36
    ndk { abiFilters += listOf("arm64-v8a", "armeabi-v7a", "x86", "x86_64") }
  }
  buildTypes {
    getByName("release") { proguardFiles("${paths.proguardRules}") }
  }
  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }
  kotlinOptions { jvmTarget = "17" }
  val keystore = providers.gradleProperty("${signingInputNames[0]}").orNull ?: System.getenv("${signingInputNames[0]}")
  val storePassword = providers.gradleProperty("${signingInputNames[1]}").orNull ?: System.getenv("${signingInputNames[1]}")
  val keyAlias = providers.gradleProperty("${signingInputNames[2]}").orNull ?: System.getenv("${signingInputNames[2]}")
  val keyPassword = providers.gradleProperty("${signingInputNames[3]}").orNull ?: System.getenv("${signingInputNames[3]}")
}
tasks.named("preBuild").configure { dependsOn(generateUniFfiKotlin) }
`;
  put(
    root,
    paths.settingsGradle,
    'rootProject.name = "Harbor"\ninclude(":app")\n',
  );
  put(
    root,
    paths.projectGradle,
    `plugins {
  id("com.android.application") version "8.13.2" apply false
  id("org.jetbrains.kotlin.android") version "2.0.21" apply false
  id("org.jetbrains.kotlin.plugin.compose") version "2.0.21" apply false
}\n`,
  );
  put(root, paths.appGradle, appGradle);
  put(
    root,
    paths.wrapperProperties,
    "distributionUrl=https\\://services.gradle.org/distributions/gradle-8.14.3-bin.zip\n",
  );
  put(
    root,
    paths.manifest,
    `<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <uses-permission android:name="android.permission.INTERNET" />
  <application android:usesCleartextTraffic="false" />
</manifest>\n`,
  );
  put(
    root,
    `${paths.packageSourceRoot}/MainActivity.kt`,
    "package dev.harbor.mobile\n",
  );
  put(root, "android/app/src/test/kotlin/dev/harbor/mobile/SmokeTest.kt");
  put(
    root,
    "android/app/src/androidTest/kotlin/dev/harbor/mobile/LaunchTest.kt",
  );
  put(root, paths.lintConfig, "<lint />\n");
  put(
    root,
    paths.proguardRules,
    `-keep class com.sun.jna.** { *; }
-keep class * implements com.sun.jna.** { *; }
-dontwarn java.awt.Component
-dontwarn java.awt.GraphicsEnvironment
-dontwarn java.awt.HeadlessException
-dontwarn java.awt.Window
`,
  );
  put(
    root,
    paths.udl,
    "namespace harbor {};\ninterface Harbor { string ping(); };\n",
  );
  put(root, paths.uniffiConfig, "[bindings.kotlin]\n");
  put(root, paths.cargoLock, "# lock\n");
  put(
    root,
    paths.buildScript,
    `#!/usr/bin/env bash
sdk="\${ANDROID_SDK_ROOT:-\${ANDROID_HOME:-}}"
ndk="\${ANDROID_NDK_HOME:-$sdk/ndk/27.0.12077973}"
command -v cargo-ndk >/dev/null || cargo ndk --version
rm -f android/app/src/main/jniLibs/{arm64-v8a,armeabi-v7a,x86,x86_64}/libharbor.so
cargo ndk -t arm64-v8a -t armeabi-v7a -t x86 -t x86_64 -o android/app/src/main/jniLibs build
release_apk="${paths.releaseApk}"
release_aab="${paths.releaseAab}"
provenance="${paths.provenanceFile}"
version="\${HARBOR_ANDROID_RELEASE_VERSION:?}"
llvm-objdump -p libharbor.so
zipalign -c -P 16 -v 4 "$release_apk"
`,
  );
  put(root, paths.abiVerifier, "readelf -Ws libharbor.so | grep checksum\n");
  put(
    root,
    paths.provenanceScript,
    `#!/usr/bin/env bash
apk="${paths.releaseApk}"
aab="${paths.releaseAab}"
manifest="${paths.provenanceFile}"
git status --porcelain
version="\${HARBOR_ANDROID_RELEASE_VERSION:?}"
sha256sum "$apk" "$aab"
mv "$manifest.tmp" "$manifest"
`,
  );

  return {
    root,
    section: {
      namespace: "dev.harbor.mobile",
      applicationId: "dev.harbor.mobile",
      minSdk: 24,
      compileSdk: 36,
      targetSdk: 36,
      gradleVersion: "8.14.3",
      agpVersion: "8.13.2",
      kotlinVersion: "2.0.21",
      javaVersion: 17,
      ndkVersion: "27.0.12077973",
      abis: ["arm64-v8a", "armeabi-v7a", "x86", "x86_64"],
      nativeLibrary: "libharbor.so",
      releaseVersionInput: "HARBOR_ANDROID_RELEASE_VERSION",
      signingPrefix,
      signingInputNames: [...signingInputNames],
      debugCleartext: false,
      selectedCapabilities: [],
      allowedPermissions: ["android.permission.INTERNET"],
      paths,
      evidenceDir: "android/app/build/template-checks/android-shell",
      assertions: assertionPlan(),
    },
  };
}

describe("portable Android shell contract logic", () => {
  it("accepts a neutral pinned Compose/cargo-ndk shell and complete host plan", () => {
    const { root, section } = fixture();
    expect(validateAndroidShellConfig(section)).toEqual([]);
    expect(validateAndroidShellScaffold(root, section)).toEqual([]);
    expect(validateAndroidCommandPlan(section)).toEqual([]);
  });

  it("catches identity, toolchain, ABI, and incremental-binding drift", () => {
    const { root, section } = fixture();
    put(
      root,
      section.paths.appGradle,
      `android {
      namespace = "dev.wrong"
      compileSdk = 35
      defaultConfig { applicationId = "dev.wrong"; minSdk = 23; targetSdk = 35 }
    }\n`,
    );
    const errors = validateAndroidShellScaffold(root, section).join("\n");
    expect(errors).toContain("missing namespace dev.harbor.mobile");
    expect(errors).toContain("missing compileSdk 36");
    expect(errors).toContain("abiFilters must declare the exact four-ABI set");
    expect(errors).toContain("incremental binding contract missing");
  });

  it("rejects release cleartext, developer-home SDK fallback, and literal signing values", () => {
    const { root, section } = fixture();
    put(
      root,
      section.paths.manifest,
      `<manifest xmlns:android="http://schemas.android.com/apk/res/android">
      <uses-permission android:name="android.permission.INTERNET" />
      <application android:usesCleartextTraffic="true" />
    </manifest>\n`,
    );
    const app = readFileSync(join(root, section.paths.appGradle), "utf8");
    put(
      root,
      section.paths.appGradle,
      `${app}\nval leaked = storePassword = "secret"\n`,
    );
    const build = readFileSync(join(root, section.paths.buildScript), "utf8");
    put(root, section.paths.buildScript, `${build}\nsdk="$HOME/Android/Sdk"\n`);
    const errors = validateAndroidShellScaffold(root, section).join("\n");
    expect(errors).toContain("main/release cleartext may not be literal true");
    expect(errors).toContain(
      "developer-home Android SDK fallback is forbidden",
    );
    expect(errors).toContain(
      "literal signing credential/alias value is forbidden",
    );
  });

  it("rejects an incomplete or vacuously passing command plan", () => {
    const { section } = fixture();
    section.assertions = section.assertions.filter(
      (entry) => entry.leg !== "instrumentation",
    );
    const signing = section.assertions.find(
      (entry) => entry.leg === "signing-absence",
    )!;
    signing.expectedExit = "zero";
    signing.unsetEnv = [];
    const errors = validateAndroidCommandPlan(section).join("\n");
    expect(errors).toContain("MOB-AND-005/instrumentation");
    expect(errors).toContain("signing-absence must expect nonzero");
    expect(errors).toContain(
      `signing-absence must unset ${signingInputNames[0]}`,
    );
  });

  it("rejects release minification without the complete JNA/R8 rule set", () => {
    const { root, section } = fixture();
    put(
      root,
      section.paths.proguardRules,
      `-keep class com.sun.jna.** { *; }
-keep class * implements com.sun.jna.** { *; }
-dontwarn java.awt.Component
`,
    );
    const errors = validateAndroidShellScaffold(root, section).join("\n");
    expect(errors).toContain("-dontwarn java.awt.GraphicsEnvironment");
    expect(errors).toContain("-dontwarn java.awt.HeadlessException");
    expect(errors).toContain("-dontwarn java.awt.Window");
  });

  it("keeps the GUIDE acceptance bar outcome-based and host-capable", () => {
    const guide = readFileSync(
      new URL("../GUIDE.md", import.meta.url),
      "utf8",
    ).replace(/\s+/g, " ");
    expect(guide).toContain("renders real Rust-core output");
    expect(guide).toContain("A live process alone is not acceptance evidence");
    expect(guide).toContain("Android-native assertion");
    expect(guide).toContain("host-constrained, never green");
  });

  it("writes atomic evidence for pass, expected failure, and host constraint", () => {
    const { root, section } = fixture();
    const pass = runAndroidAssertionCommand(root, section.evidenceDir, {
      assertionId: "MOB-AND-005",
      leg: "unit",
      command: [process.execPath, "-e", "process.exit(0)"],
    });
    expect(pass.evidence.verdict).toBe("pass");
    expect(existsSync(pass.evidencePath)).toBe(true);

    const negative = runAndroidAssertionCommand(root, section.evidenceDir, {
      assertionId: "MOB-AND-006",
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

    const constrained = runAndroidAssertionCommand(root, section.evidenceDir, {
      assertionId: "MOB-AND-001",
      leg: "toolchain-build",
      command: ["papercusp-deliberately-missing-android-tool"],
    });
    expect(constrained.evidence.verdict).toBe("host-constrained");
    expect(
      JSON.parse(readFileSync(constrained.evidencePath, "utf8")).verdict,
    ).toBe("host-constrained");
  });
});
