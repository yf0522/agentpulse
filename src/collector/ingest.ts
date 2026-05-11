import type { ClaudeStatuslineInput, AgentKind } from "../lib/types.ts";
import { calcCost, getContextLimit } from "../lib/pricing.ts";
import { upsertSession, insertEvent } from "../db/store.ts";

export interface IngestPayload {
  agent: AgentKind;
  sessionId: string;
  ts: number;
  cwd?: string | null;
  model?: string | null;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  contextUsed?: number;
  contextLimit?: number;
  rateLimitRemaining?: number | null;
  rateLimitResetAt?: number | null;
  costUsd?: number;
  raw?: string | null;
}

export function ingest(p: IngestPayload): void {
  const ts = p.ts || Date.now();
  upsertSession({
    id: p.sessionId,
    agent: p.agent,
    cwd: p.cwd ?? null,
    model: p.model ?? null,
    ts,
  });
  const inputTokens = p.inputTokens ?? 0;
  const outputTokens = p.outputTokens ?? 0;
  const cacheReadTokens = p.cacheReadTokens ?? 0;
  const cacheCreationTokens = p.cacheCreationTokens ?? 0;
  const contextUsed = p.contextUsed ?? 0;
  const contextLimit = p.contextLimit ?? getContextLimit(p.model);
  const costUsd =
    p.costUsd ??
    calcCost({
      model: p.model,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheCreationTokens,
    });
  insertEvent({
    sessionId: p.sessionId,
    ts,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheCreationTokens,
    contextUsed,
    contextLimit,
    rateLimitRemaining: p.rateLimitRemaining ?? null,
    rateLimitResetAt: p.rateLimitResetAt ?? null,
    model: p.model ?? null,
    costUsd,
    raw: p.raw ?? null,
  });
}

/**
 * Parse Claude Code statusline JSON (delivered to the hook on stdin).
 * Token counts come from the transcript, but Claude Code's statusline payload
 * does NOT include them directly — only cost + duration. We grab cost as
 * authoritative and derive a coarse token estimate from the cost when needed.
 */
export function parseClaudeStatusline(json: ClaudeStatuslineInput): IngestPayload | null {
  const sessionId = json.session_id;
  if (!sessionId) return null;
  const model = json.model?.id ?? json.model?.display_name ?? null;
  const cwd = json.workspace?.current_dir ?? json.cwd ?? null;
  const contextLimit = getContextLimit(model);
  const exceeds = json.exceeds_200k_tokens === true;
  const contextUsed = exceeds && contextLimit === 200_000 ? 200_000 : 0;
  return {
    agent: "claude-code",
    sessionId,
    ts: Date.now(),
    cwd,
    model,
    contextUsed,
    contextLimit,
    costUsd: json.cost?.total_cost_usd ?? 0,
    raw: JSON.stringify(json),
  };
}
