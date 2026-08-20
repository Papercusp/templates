import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const untilde = (value: string): string => value.startsWith("~/")
  ? join(homedir(), value.slice(2))
  : value;
const configPath = process.env.TEMPLATE_CHECKS_CONFIG;
const config: Record<string, any> | null = configPath
  ? JSON.parse(readFileSync(resolve(untilde(configPath)), "utf8"))
  : null;
const appRoot = config
  ? resolve(dirname(resolve(untilde(configPath!))), untilde(config.app?.root ?? "."))
  : null;
const inApp = (value: string): string => isAbsolute(untilde(value))
  ? untilde(value)
  : join(appRoot!, value);

const section = config?.projectHistory as {
  artifact: string;
  projectId?: string;
  harness?: string;
} | undefined;

function readArtifact(path: string): Record<string, any> {
  const source = readFileSync(path, "utf8").trim();
  if (source.startsWith("{")) return JSON.parse(source);
  const match = source.match(/export\s+const\s+[A-Za-z_$][\w$]*\s*=\s*([\s\S]+)\s+as\s+const;?$/);
  if (!match?.[1]) throw new Error(`unsupported Project History artifact format: ${path}`);
  return JSON.parse(match[1]);
}

describe.skipIf(!section)("project-history artifact", () => {
  it("is a versioned artifact for the configured project and harness", () => {
    const document = readArtifact(inApp(section!.artifact));
    expect(document.schemaVersion).toBe(1);
    expect(document.source?.kind).toBe("papercusp-plan-export");
    expect(document.source?.generator).toBe("papercusp project-history generate");
    expect(Array.isArray(document.plans)).toBe(true);
    expect(document.source?.planCount).toBe(document.plans.length);
    if (section!.projectId) expect(document.project?.id).toBe(section!.projectId);
    if (section!.harness) expect(document.source?.harness).toBe(section!.harness);
  });
});
