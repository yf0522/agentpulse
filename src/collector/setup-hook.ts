import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { claudeSettingsPath } from "../lib/paths.ts";

export function installClaudeStatuslineHook(binPath: string): { changed: boolean; path: string } {
  const path = claudeSettingsPath();
  mkdirSync(dirname(path), { recursive: true });
  let cfg: Record<string, unknown> = {};
  if (existsSync(path)) {
    try {
      cfg = JSON.parse(readFileSync(path, "utf8"));
    } catch {
      cfg = {};
    }
  }
  const command = `${binPath} hook`;
  const existing = (cfg.statusLine as { type?: string; command?: string } | undefined) ?? null;
  if (existing && existing.command === command) {
    return { changed: false, path };
  }
  cfg.statusLine = { type: "command", command };
  writeFileSync(path, JSON.stringify(cfg, null, 2) + "\n");
  return { changed: true, path };
}

export function uninstallClaudeStatuslineHook(): { changed: boolean; path: string } {
  const path = claudeSettingsPath();
  if (!existsSync(path)) return { changed: false, path };
  let cfg: Record<string, unknown>;
  try {
    cfg = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return { changed: false, path };
  }
  const sl = cfg.statusLine as { command?: string } | undefined;
  if (!sl || !sl.command || !sl.command.includes("agentpulse")) {
    return { changed: false, path };
  }
  delete cfg.statusLine;
  writeFileSync(path, JSON.stringify(cfg, null, 2) + "\n");
  return { changed: true, path };
}
