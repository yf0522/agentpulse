export type AgentKind = "claude-code" | "codex" | "cursor" | "unknown";

export interface SessionRow {
  id: string;
  agent: AgentKind;
  cwd: string | null;
  model: string | null;
  started_at: number;
  last_seen_at: number;
}

export interface EventRow {
  id: number;
  session_id: string;
  ts: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  context_used: number;
  context_limit: number;
  rate_limit_remaining: number | null;
  rate_limit_reset_at: number | null;
  model: string | null;
  cost_usd: number;
  raw: string | null;
}

export interface SessionSummary {
  session: SessionRow;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheCreationTokens: number;
  contextUsed: number;
  contextLimit: number;
  contextPct: number;
  rateLimitRemaining: number | null;
  rateLimitResetAt: number | null;
  costUsd: number;
  lastEventAt: number;
}

export interface ClaudeStatuslineInput {
  hook_event_name?: string;
  session_id?: string;
  transcript_path?: string;
  cwd?: string;
  model?: { id?: string; display_name?: string };
  workspace?: { current_dir?: string; project_dir?: string };
  cost?: {
    total_cost_usd?: number;
    total_duration_ms?: number;
    total_api_duration_ms?: number;
    total_lines_added?: number;
    total_lines_removed?: number;
  };
  exceeds_200k_tokens?: boolean;
  output_style?: { name?: string };
}
