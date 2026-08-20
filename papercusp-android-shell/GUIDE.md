# papercusp-android-shell — composition GUIDE

**Papercusp Official: Android Shell.** This aspect supplies the Android-native
chassis around `papercusp-mobile-base`: one thin Compose app module, pinned
build inputs, generated Kotlin bindings, four Rust ABIs, platform-native
tests, privacy checks, and a verifiable APK/AAB release pair. It is not a
product app and does not own domain behavior, screens, routes, brand, assets,
endpoints, or provider integrations.

## MUST — consult the live Papercusp docs when this GUIDE is not enough

Use the live `/internal/docs` pages declared in `template.yaml` for template
composition and manifest rules. Treat Papercusp and SideStage as independent,
co-equal conformance consumers. Extract the verified invariant; never clone a
product build file, package name, permission set, endpoint, or dependency
graph wholesale.

## Decide first

Record all five decision-point answers before building the shell:

1. `android-identity` — choose namespace, application ID, source package,
   display/launcher identity, and one release-version input. One answer drives
   every representation unless an explicit divergence is recorded.
2. `android-sdk-floor` — keep min SDK 24 unless a selected capability proves a
   higher floor. Compile and target SDK remain pinned at 36 in v0.1.
3. `android-local-network` — default to no cleartext. If a local emulator or
   device endpoint is required, constrain it to debug and a named host; release
   remains cleartext-free.
4. `android-capabilities` — select every optional permission, feature, service,
   plugin, repository, and dependency explicitly. An unselected capability
   contributes nothing to the default closure.
5. `android-release` — name external signing inputs, the release version input,
   channel, and generated provenance path. Names are configuration; signing
   values and keystores never enter source or checks config.

Start from `reference/android-shell.checks-config.example.json`, then replace
every identity, path, command, permission, and capability selection. Compose
and run the `papercusp-mobile-base` checks alongside this suite.

## MUST

- Keep one app module and repository-policy settings. Pin Gradle `8.14.3`, AGP
  `8.13.2`, Kotlin/Compose `2.0.21`, Java `17`, compile/target SDK `36`, NDK
  `27.0.12077973`, and the chosen min SDK. Resolve the SDK from
  `ANDROID_SDK_ROOT`/`ANDROID_HOME` or an explicit supported resolver—never a
  developer-home path embedded in source.
- Register incremental Kotlin UniFFI generation as a Gradle input/output task.
  Its inputs include the UDL, `uniffi.toml`, and `Cargo.lock`; `preBuild`
  depends on it. Generated Kotlin is an artifact, not a second boundary.
- Delete every expected JNI output before `cargo-ndk`, then build exactly
  `arm64-v8a`, `armeabi-v7a`, `x86`, and `x86_64`. Verify the packaged APK and
  AAB contents; source `abiFilters` alone are not evidence.
- Verify generated Kotlin checksum symbols against each packaged `.so`. Check
  every 64-bit release ELF LOAD alignment and run `zipalign -P 16` on the
  release APK.
- Run lint, JVM unit smoke, instrumentation launch/navigation smoke, and a
  merged release-manifest permission diff with non-zero expected execution.
  Missing tools, SDKs, devices, or capable hosts report `host-constrained`,
  never green.
- Release forbids cleartext. A debug-only exception is explicit and scoped;
  selected permissions/services/plugins must match the recorded capability
  answer and merged-manifest allowlist.
- Build the release APK and AAB from one requested version and clean commit.
  Verify package metadata, exact artifact paths, SHA-256 hashes, and source
  commit before atomically publishing provenance.
- Signing inputs have names only and are read from external Gradle properties
  or environment. A normal debug build may be unsigned; a publishable release
  must fail preflight when the signing identity is absent.
- Run `checks/android-shell-contract.test.ts` and
  `checks/android-shell-commands.test.ts`. Every host leg writes an atomic JSON
  record containing its stable assertion ID, verdict, host, capability,
  command identity, and evidence digest.

## SHOULD

- Keep `MainActivity`, theme/token hookup, navigation/root state, and native
  wrappers thin. Portable outcomes and state stay in Rust.
- Make the SDK/cargo-ndk preflight independently runnable so environment
  failures are diagnosed before a long cross-build.
- Keep release verification scripts parameterized by package/library/version
  inputs and cover their negative paths with fixture tests.
- Put generated bindings, JNI libraries, Gradle caches/reports, APKs, AABs,
  signing files, and machine evidence outside tracked source.

## FREE

Compose navigation and screen structure, product dependencies, asset pipeline,
brand, copy, runtime endpoint loading, and selected capability implementations
are consumer choices. They remain outside this aspect unless a cross-product
invariant is proven and versioned.

## Acceptance meaning

The command plan covers `MOB-AND-001` through `MOB-AND-006` from the frozen
parity matrix. A command failure is `fail`; a missing capable host/tool is
`host-constrained`; neither is green. Thin app roots later verify only exact
dependency closure and answer completeness—they do not duplicate these shell
assertions.
