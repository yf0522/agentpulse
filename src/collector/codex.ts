import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";
import { homedir } from "node:os";
import { ingest } from "./ingest.ts";
import { calcCost, getContextLimit } from "../lib/pricing.ts";

/**
 * Codex CLI doesn't expose a statusline hook the way Claude Code does, so we
 * ingest by reading its rollout / session files.
 *
 * Codex writes JSONL session files to `~/.codex/sessions/` (default). Schema
 * varies across versions; this parser is intentionally lenient — it picks up
 * any line that has a `usage` object with input/output tokens.
 */

export const DEFAULT_CODEX_DIR = join(homedir(), ".codex", "sessions");

interface CodexUsage {
  input_tokens?: number;
  output_tokens?: number;
  cached_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  input_tokens_details?: { cached_tokens?: number };
}

interface CodexLine {
  id?: string;
  type?: string;
  timestamp?: string;
  ts?: number | string;
  session_id?: string;
  model?: string;
  usage?: CodexUsage;
  cost?: number;
  cwd?: string;
  cost_usd?: number;
}

function tsOf(line: CodexLine, fallback: number): number {
  if (typeof line.ts === "number") return line.ts;
  const raw = line.timestamp ?? line.ts ?? null;
  if (typeof raw === "string") {
    const t = Date.parse(raw);
    if (!Number.isNaN(t)) return t;
  }
  return fallback;
}

function priceCodex(model: string | undefined): { input: number; output: number; cached: number } {
  if (!model) return { input: 2.5, output: 10, cached: 0.25 };
  const m = model.toLowerCase();
  // Rough OpenAI pricing per 1M tokens (USD). Tune as needed.
  if (m.includes("gpt-5")) return { input: 10, output: 30, cached: 1 };
  if (m.includes("gpt-4o")) return { input: 2.5, output: 10, cached: 1.25 };
  if (m.includes("o4")) return { input: 5, output: 20, cached: 1.25 };
  if (m.includes("o3")) return { input: 10, output: 40, cached: 2.5 };
  return { input: 2.5, output: 10, cached: 1.25 };
}

export interface IngestCodexResult {
  file: string;
  sessionId: string;
  events: number;
}

export function ingestCodexFile(path: string): IngestCodexResult | null {
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, "utf8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return null;

  const fileMtime = statSync(path).mtimeMs;
  let sessionId = "";
  let model: string | undefined;
  let cwd: string | undefined;
  let events = 0;

  // First pass: find a session id + model + cwd from any line that has them.
  for (const l of lines) {
    let obj: CodexLine;
    try { obj = JSON.parse(l); } catch { continue; }
    if (!sessionId && (obj.session_id || obj.id)) sessionId = obj.session_id ?? obj.id ?? "";
    if (!model && obj.model) model = obj.model;
    if (!cwd && obj.cwd) cwd = obj.cwd;
  }

  // Fallback: derive a session id from the filename.
  if (!sessionId) sessionId = `codex-${basename(path).replace(/\.(jsonl|log|txt)$/i, "")}`;

  for (const l of lines) {
    let obj: CodexLine;
    try { obj = JSON.parse(l); } catch { continue; }
    const u = obj.usage;
    if (!u) continue;
    const input = u.input_tokens ?? 0;
    const output = u.output_tokens ?? 0;
    const cached =
      u.cache_read_input_tokens ?? u.cached_tokens ?? u.input_tokens_details?.cached_tokens ?? 0;
    const cacheCreation = u.cache_creation_input_tokens ?? 0;
    if (input + output + cached + cacheCreation === 0) continue;

    const m = obj.model ?? model;
    const ts = tsOf(obj, fileMtime);
    let costUsd: number;
    if (typeof obj.cost_usd === "number") {
      costUsd = obj.cost_usd;
    } else if (typeof obj.cost === "number") {
      costUsd = obj.cost;
    } else {
      const p = priceCodex(m);
      costUsd =
        (input / 1_000_000) * p.input +
        (output / 1_000_000) * p.output +
        (cached / 1_000_000) * p.cached;
      costUsd = Math.round(costUsd * 100000) / 100000;
    }

    ingest({
      agent: "codex",
      sessionId,
      ts,
      cwd: cwd ?? null,
      model: m ?? null,
      inputTokens: input,
      outputTokens: output,
      cacheReadTokens: cached,
      cacheCreationTokens: cacheCreation,
      contextLimit: getContextLimit(m),
      costUsd,
      raw: l,
    });
    events++;
  }

  return { file: path, sessionId, events };
}

export function ingestCodexDirectory(dir: string): IngestCodexResult[] {
  if (!existsSync(dir)) return [];
  const out: IngestCodexResult[] = [];
  for (const entry of readdirSync(dir)) {
    if (!/\.(jsonl|log)$/i.test(entry)) continue;
    const r = ingestCodexFile(join(dir, entry));
    if (r) out.push(r);
  }
  return out;
}

/**
 * Live-watch a Codex sessions directory. Re-ingests any file that grows
 * (idempotent ingest is OK for now — events table has no dedup but cost is
 * additive and we'll accept duplicate-on-replay as a known limitation for v0).
 */
export async function watchCodexDirectory(dir: string): Promise<void> {
  if (!existsSync(dir)) {
    console.error(`agentpulse: codex dir not found: ${dir}`);
    process.exit(1);
  }
  console.log(`agentpulse: watching ${dir}`);
  // Initial sweep
  const initial = ingestCodexDirectory(dir);
  for (const r of initial) {
    console.log(`  ingest ${basename(r.file)}  session=${r.sessionId.slice(0, 12)}  events=${r.events}`);
  }

  const seen = new Map<string, number>(); // path → mtimeMs
  for (const f of readdirSync(dir).filter((f) => /\.(jsonl|log)$/i.test(f))) {
    seen.set(join(dir, f), statSync(join(dir, f)).mtimeMs);
  }

  const { watch } = await import("node:fs");
  watch(dir, { persistent: true }, (_event, filename) => {
    if (!filename || !/\.(jsonl|log)$/i.test(filename)) return;
    const full = join(dir, filename);
    if (!existsSync(full)) return;
    const mtime = statSync(full).mtimeMs;
    if (seen.get(full) === mtime) return;
    seen.set(full, mtime);
    const r = ingestCodexFile(full);
    if (r) {
      console.log(`  ingest ${filename}  session=${r.sessionId.slice(0, 12)}  events=${r.events}`);
    }
  });

  // Keep the process alive
  await new Promise(() => {});
}
