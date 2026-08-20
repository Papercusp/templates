/**
 * Portable shared-mobile verification commands.
 * Config: TEMPLATE_CHECKS_CONFIG.mobileBase.portableCommands.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const untilde = (path: string): string =>
  path.startsWith("~/") ? join(homedir(), path.slice(2)) : path;
const configPath = process.env.TEMPLATE_CHECKS_CONFIG;
const config: Record<string, any> | null = configPath
  ? JSON.parse(readFileSync(resolve(untilde(configPath)), "utf8"))
  : null;
const appRoot: string | null = config
  ? resolve(
      dirname(resolve(untilde(configPath!))),
      untilde(config.app?.root ?? "."),
    )
  : null;

interface MobileCommand {
  id: string;
  command: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
}

const commands = config?.mobileBase?.portableCommands as
  | MobileCommand[]
  | undefined;
const DEFAULT_COMMAND_TIMEOUT_MS = 300_000;
const COMMAND_TIMEOUT_GRACE_MS = 5_000;
const commandTestTimeoutMs =
  Math.max(
    DEFAULT_COMMAND_TIMEOUT_MS,
    ...(commands ?? []).map(
      (entry) => entry.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS,
    ),
  ) + COMMAND_TIMEOUT_GRACE_MS;
const inApp = (path: string): string =>
  isAbsolute(untilde(path)) ? untilde(path) : join(appRoot!, path);

describe.skipIf(!commands)("mobile-base-commands", () => {
  it("covers every required portable verification leg exactly once", () => {
    const ids = commands!.map((command) => command.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const required of [
      "rust-fmt",
      "rust-clippy",
      "rust-test",
      "binding-smoke",
      "token-drift",
    ]) {
      expect(ids, `missing required portable command '${required}'`).toContain(
        required,
      );
    }
  });

  it("keeps the outer Vitest window beyond every child-command budget", () => {
    const largestChildTimeout = Math.max(
      DEFAULT_COMMAND_TIMEOUT_MS,
      ...(commands ?? []).map(
        (entry) => entry.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS,
      ),
    );
    expect(commandTestTimeoutMs).toBeGreaterThan(largestChildTimeout);
  });

  it.each(commands ?? [])(
    "$id exits zero",
    (entry) => {
      const [command, ...args] = entry.command;
      expect(command, `${entry.id}: empty command`).toBeTruthy();
      const result = spawnSync(command!, args, {
        cwd: entry.cwd ? inApp(entry.cwd) : appRoot!,
        env: { ...process.env, ...(entry.env ?? {}) },
        encoding: "utf8",
        timeout: entry.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS,
      });
      const evidence = [result.stdout, result.stderr]
        .filter(Boolean)
        .join("\n")
        .slice(-8_000);
      expect(
        result.error,
        `${entry.id}: ${result.error?.message ?? "spawn error"}\n${evidence}`,
      ).toBeUndefined();
      expect(
        result.status,
        `${entry.id}: exited ${result.status}\n${evidence}`,
      ).toBe(0);
    },
    commandTestTimeoutMs,
  );
});
