/**
 * boot-e2e — the composed app boots: sidecar spawns, discovery file written,
 * health 200, graceful shutdown cleans up. (papercusp-tauri-desktop-shell template
 * check; plan app-templates-2026-07-04 P-007.)
 *
 * PORTABLE + APP-PARAMETERIZED: copied verbatim into a composed app, driven by
 * the TEMPLATE_CHECKS_CONFIG JSON (schema: @papercusp/template-kit
 * `TemplateChecksConfig`, section `boot`). Skips without the env var. Needs
 * only `vitest` (Node ≥18 native fetch).
 *
 * Config section:
 *   boot: {
 *     mode: "spawn" | "attach"
 *     discoveryFile: string       // the operator.json analog ("~/…" ok)
 *     healthPath?: string         // default "/api/health"
 *     buildCommand?: string[]     // optional "app builds" leg (spawn mode)
 *     command?: string[]          // REQUIRED in spawn mode: boots the sidecar
 *     cwd?: string                // app-root-relative; default app root
 *     env?: Record<string,string> // extra env for the spawned sidecar
 *     buildTimeoutMs?: number     // default 1800000 (buildCommand budget; the
 *                                 //   vitest timeout is DERIVED from it)
 *     readyTimeoutMs?: number     // default 120000
 *     shutdownGraceMs?: number    // default 15000 (the shell's force-exit
 *                                 //   timer must beat this — WI-2667 lesson)
 *     pgDataDir?: string          // spawn mode only: the embedded PG data dir
 *                                 //   the sidecar boots against. When set, a
 *                                 //   LIVE postmaster.pid lock there (a
 *                                 //   DIFFERENT already-running deployment
 *                                 //   holding it) fails the check FAST instead
 *                                 //   of spawning a doomed sidecar and burning
 *                                 //   the full readyTimeoutMs (EI-22125738148136740)
 *   }
 *
 * TWO MODES because the discovery file is a per-user singleton (the shell +
 * CLI read ONE ~/.{app}/operator.json): `spawn` boots a fresh sidecar and
 * asserts the full lifecycle INCLUDING cleanup — use it in CI / the template
 * gym / a fresh checkout. `attach` asserts against an ALREADY-RUNNING
 * instance (discovery file present, pid alive, health 200) — use it on a
 * machine where the app is live, where spawning a second instance would
 * clobber the live discovery file.
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
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

interface BootSection {
  mode: "spawn" | "attach";
  discoveryFile: string;
  healthPath?: string;
  buildCommand?: string[];
  command?: string[];
  cwd?: string;
  env?: Record<string, string>;
  buildTimeoutMs?: number;
  readyTimeoutMs?: number;
  shutdownGraceMs?: number;
  pgDataDir?: string;
}
const section = config?.boot as BootSection | undefined;

// ── budgets ─────────────────────────────────────────────────────────────────
// Each leg of the spawn test owns a budget, and the vitest timeout is DERIVED
// from their sum — never a second constant maintained beside them.
//
// It used to be two hand-written numbers: a 600s `buildCommand` budget under a
// 780s vitest timeout that also had to cover boot + ready + shutdown. Both were
// too small for a real production build (measured 8–10min of compile alone,
// before the TypeScript pass), so the check went red as a function of machine
// load rather than of code correctness — and raising either one alone just
// moves the failure to the other. Deriving the outer budget is what stops the
// pair drifting back apart. (EI-22025223570144566.)
const buildTimeoutMs = section?.buildTimeoutMs ?? 1_800_000;
const readyTimeoutMs = section?.readyTimeoutMs ?? 120_000;
const shutdownGraceMs = section?.shutdownGraceMs ?? 15_000;
// Covers the legs with no budget of their own: health polling, the
// discovery-file settle, the SIGTERM round-trip, and vitest's own overhead.
const SPAWN_SLACK_MS = 120_000;
const spawnTestTimeoutMs =
  (section?.buildCommand?.length ? buildTimeoutMs : 0) + readyTimeoutMs + shutdownGraceMs + SPAWN_SLACK_MS;

interface NativeDesktopSection {
  cargoManifest: string;
  cargoLock: string;
  tauriConfig: string;
  icons: string[];
}
const nativeDesktop = config?.nativeDesktop as NativeDesktopSection | undefined;

interface Discovery {
  port: number;
  host?: string;
  pid?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function readDiscovery(path: string): Discovery | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Discovery;
  } catch {
    return null; // torn read mid-write — treat as not-yet-ready
  }
}

async function healthStatus(disc: Discovery, healthPath: string): Promise<number | null> {
  try {
    const res = await fetch(`http://${disc.host ?? "127.0.0.1"}:${disc.port}${healthPath}`);
    return res.status;
  } catch {
    return null;
  }
}

/**
 * Read `<dataDir>/postmaster.pid` and report whether it names a still-LIVE
 * process — the ground-truth signal that a DIFFERENT deployment (a portal, a
 * prior instance) already holds this embedded PG data directory, as opposed
 * to a stale lockfile left by an unclean exit. Returns the locking pid, or
 * `null` when there is no conclusive live lock (no file, unreadable,
 * unparseable, or the named pid is dead). Deliberately independent of the
 * app tree's own `sweepOrphanPostgres` — this file stays dependency-free of
 * the kit per the portable-checks contract at the top of this file.
 */
function pgDataDirLockedBy(dataDir: string): number | null {
  const pidFile = join(untilde(dataDir), "postmaster.pid");
  if (!existsSync(pidFile)) return null;
  let raw: string;
  try {
    raw = readFileSync(pidFile, "utf8");
  } catch {
    return null; // torn/unreadable — not a conclusive live lock
  }
  const pid = Number((raw.split("\n")[0] ?? "").trim());
  if (!Number.isInteger(pid) || pid <= 0) return null;
  try {
    process.kill(pid, 0); // signal 0: existence probe only, never kills
    return pid;
  } catch {
    return null; // pid dead — a stale lockfile, not a live collision
  }
}

describe.skipIf(!nativeDesktop)("native-desktop-preflight", () => {
  it("tracks the Rust manifest + lockfile and every icon configured for the Tauri bundle", () => {
    const required = [
      nativeDesktop!.cargoManifest,
      nativeDesktop!.cargoLock,
      nativeDesktop!.tauriConfig,
      ...nativeDesktop!.icons,
    ];
    for (const relativePath of required) {
      const path = inApp(relativePath);
      expect(existsSync(path), `missing native desktop input: ${relativePath}`).toBe(true);
      expect(statSync(path).size, `empty native desktop input: ${relativePath}`).toBeGreaterThan(0);
    }

    const tauriConfigPath = inApp(nativeDesktop!.tauriConfig);
    const tauriConfig = JSON.parse(readFileSync(tauriConfigPath, "utf8")) as {
      bundle?: { active?: boolean; icon?: string[] };
    };
    expect(tauriConfig.bundle?.active, "Tauri bundling must be explicitly active").toBe(true);
    expect(tauriConfig.bundle?.icon, "bundle.icon must explicitly list every shipped icon").toBeInstanceOf(Array);

    const configuredIcons = (tauriConfig.bundle!.icon ?? [])
      .map((path) => resolve(dirname(tauriConfigPath), path))
      .sort();
    const checkedIcons = nativeDesktop!.icons.map((path) => inApp(path)).sort();
    expect(configuredIcons).toEqual(checkedIcons);
  });
});

describe.skipIf(!section)("boot-e2e", () => {
  const healthPath = section?.healthPath ?? "/api/health";
  const discoveryFile = () => untilde(section!.discoveryFile);

  it.skipIf(section?.mode !== "attach")("attach: discovery file present, pid alive, health 200", async () => {
    const disc = readDiscovery(discoveryFile());
    expect(disc, `no readable discovery file at ${discoveryFile()} — is the app running?`).toBeTruthy();
    expect(disc!.port).toBeGreaterThan(0);
    if (disc!.pid) {
      expect(() => process.kill(disc!.pid!, 0), `discovery pid ${disc!.pid} is not alive (stale file)`).not.toThrow();
    }
    expect(await healthStatus(disc!, healthPath)).toBe(200);
  });

  it.skipIf(section?.mode !== "spawn")(
    "spawn: boot → discovery written → health 200 → SIGTERM → clean exit + file removed",
    { timeout: spawnTestTimeoutMs },
    async () => {
      expect(section!.command?.length, "boot.command required in spawn mode").toBeTruthy();
      expect(readDiscovery(discoveryFile()), `stale discovery file at ${discoveryFile()} — another instance is (or was) running; stop it first`).toBeNull();

      // A DIFFERENT deployment (e.g. a portal) can hold the SAME embedded PG
      // data dir without ever touching THIS app's discovery file, so the
      // check above cannot see it. Spawning against a locked data dir is
      // doomed — Postgres refuses a second postmaster ("FATAL: lock file
      // postmaster.pid already exists") — so without this check the test
      // just polls a health endpoint that can never come up for the full
      // readyTimeoutMs (up to 4min) before failing with a generic, misleading
      // "sidecar never became healthy" message (EI-22125738148136740).
      if (section!.pgDataDir) {
        const lockingPid = pgDataDirLockedBy(section!.pgDataDir);
        expect(
          lockingPid,
          `embedded PG data dir ${untilde(section!.pgDataDir)} is already locked by a LIVE ` +
            `process (pid ${lockingPid}) — a different instance/deployment is running on this ` +
            `machine and holds it. Spawning a second instance against the same data dir cannot ` +
            `succeed. Use boot.mode:"attach" against that instance, or point boot.pgDataDir / the ` +
            `sidecar at an isolated data dir.`,
        ).toBeNull();
      }

      if (section!.buildCommand?.length) {
        const [b, ...bArgs] = section!.buildCommand;
        const startedAt = Date.now();
        const built = spawnSync(b!, bArgs, { cwd: appRoot!, encoding: "utf8", timeout: buildTimeoutMs });
        const elapsedS = Math.round((Date.now() - startedAt) / 1000);
        const tail = `\n--- stdout ---\n${built.stdout}\n--- stderr ---\n${built.stderr}`;
        // THREE different failures reach here through the same `status: null`,
        // so diagnose them apart. Reporting a timeout kill as "buildCommand
        // failed" sends whoever triages it hunting a compile error that is not
        // there — the captured stdout even ends in "✓ Compiled successfully".
        // Check `signal` FIRST: a timeout sets `error` (ETIMEDOUT) as well, so
        // testing `error` first would relabel every timeout a spawn failure.
        expect(
          built.signal,
          `buildCommand TIMED OUT — killed with ${built.signal} after ${elapsedS}s of a ` +
            `${Math.round(buildTimeoutMs / 1000)}s budget. The build was still RUNNING; this is a ` +
            `budget failure, not a code failure. Raise boot.buildTimeoutMs if this app ` +
            `legitimately builds slower.${tail}`,
        ).toBeNull();
        expect(
          built.error,
          `buildCommand could not be spawned after ${elapsedS}s: ${built.error?.message}${tail}`,
        ).toBeUndefined();
        expect(built.status, `buildCommand failed with exit ${built.status} after ${elapsedS}s${tail}`).toBe(0);
      }

      const [cmd, ...args] = section!.command!;
      const cwd = section!.cwd ? inApp(section!.cwd) : appRoot!;
      let out = "";
      const child: ChildProcess = spawn(cmd!, args, {
        cwd,
        env: { ...process.env, ...section!.env },
        stdio: ["ignore", "pipe", "pipe"],
      });
      child.stdout!.on("data", (d) => (out += String(d)));
      child.stderr!.on("data", (d) => (out += String(d)));
      const exited = new Promise<number | null>((r) => child.once("exit", (code) => r(code)));

      try {
        // Ready = discovery file readable AND health 200 at the discovered port.
        const deadline = Date.now() + readyTimeoutMs;
        let ready = false;
        while (Date.now() < deadline) {
          const disc = readDiscovery(discoveryFile());
          if (disc && (await healthStatus(disc, healthPath)) === 200) {
            ready = true;
            break;
          }
          await sleep(500);
        }
        expect(ready, `sidecar never became healthy within ${readyTimeoutMs}ms\n--- output ---\n${out}`).toBe(true);

        // Graceful shutdown: SIGTERM → exit within grace → discovery file gone.
        child.kill("SIGTERM");
        const grace = shutdownGraceMs;
        const code = await Promise.race([exited, sleep(grace).then(() => "timeout" as const)]);
        expect(code, `sidecar did not exit within ${grace}ms of SIGTERM (wedge — see the WI-2667 force-exit-timer MUST)\n--- output ---\n${out}`).not.toBe("timeout");
        expect(existsSync(discoveryFile()), "discovery file not removed on shutdown").toBe(false);
      } finally {
        if (child.exitCode === null && !child.killed) child.kill("SIGKILL");
        else if (child.exitCode === null) {
          await sleep(1000);
          if (child.exitCode === null) child.kill("SIGKILL");
        }
      }
    },
  );
});
