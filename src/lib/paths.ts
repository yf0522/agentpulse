import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync } from "node:fs";

export function dataDir(): string {
  const dir = join(homedir(), ".agentpulse");
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function dbPath(): string {
  return join(dataDir(), "agentpulse.db");
}

export function logPath(): string {
  return join(dataDir(), "agentpulse.log");
}

export function claudeSettingsPath(): string {
  return join(homedir(), ".claude", "settings.json");
}
