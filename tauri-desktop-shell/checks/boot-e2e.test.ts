/**
 * boot-e2e — the composed app boots: sidecar spawns, discovery file written,
 * health 200, graceful shutdown cleans up. (tauri-desktop-shell template
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
 *     readyTimeoutMs?: number     // default 120000
 *     shutdownGraceMs?: number    // default 15000 (the shell's force-exit
 *                                 //   timer must beat this — WI-2667 lesson)
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
import { existsSync, readFileSync } from "node:fs";
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
  readyTimeoutMs?: number;
  shutdownGraceMs?: number;
}
const section = config?.boot as BootSection | undefined;

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
    { timeout: 780_000 },
    async () => {
      expect(section!.command?.length, "boot.command required in spawn mode").toBeTruthy();
      expect(readDiscovery(discoveryFile()), `stale discovery file at ${discoveryFile()} — another instance is (or was) running; stop it first`).toBeNull();

      if (section!.buildCommand?.length) {
        const [b, ...bArgs] = section!.buildCommand;
        const built = spawnSync(b!, bArgs, { cwd: appRoot!, encoding: "utf8", timeout: 600_000 });
        expect(built.status, `buildCommand failed:\n${built.stdout}\n${built.stderr}`).toBe(0);
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
        const deadline = Date.now() + (section!.readyTimeoutMs ?? 120_000);
        let ready = false;
        while (Date.now() < deadline) {
          const disc = readDiscovery(discoveryFile());
          if (disc && (await healthStatus(disc, healthPath)) === 200) {
            ready = true;
            break;
          }
          await sleep(500);
        }
        expect(ready, `sidecar never became healthy within ${section!.readyTimeoutMs ?? 120_000}ms\n--- output ---\n${out}`).toBe(true);

        // Graceful shutdown: SIGTERM → exit within grace → discovery file gone.
        child.kill("SIGTERM");
        const grace = section!.shutdownGraceMs ?? 15_000;
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
