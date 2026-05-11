import { getDb } from "./schema.ts";
import type { SessionRow, EventRow, SessionSummary, AgentKind } from "../lib/types.ts";
import { getContextLimit } from "../lib/pricing.ts";

export function upsertSession(args: {
  id: string;
  agent: AgentKind;
  cwd: string | null;
  model: string | null;
  ts: number;
}): void {
  const db = getDb();
  db.run(
    `INSERT INTO sessions (id, agent, cwd, model, started_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       agent = excluded.agent,
       cwd = COALESCE(excluded.cwd, sessions.cwd),
       model = COALESCE(excluded.model, sessions.model),
       last_seen_at = excluded.last_seen_at`,
    [args.id, args.agent, args.cwd, args.model, args.ts, args.ts],
  );
}

export function insertEvent(args: {
  sessionId: string;
  ts: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  contextUsed: number;
  contextLimit: number;
  rateLimitRemaining: number | null;
  rateLimitResetAt: number | null;
  model: string | null;
  costUsd: number;
  raw: string | null;
}): void {
  const db = getDb();
  db.run(
    `INSERT INTO events (
       session_id, ts, input_tokens, output_tokens,
       cache_read_tokens, cache_creation_tokens,
       context_used, context_limit,
       rate_limit_remaining, rate_limit_reset_at,
       model, cost_usd, raw
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      args.sessionId,
      args.ts,
      args.inputTokens,
      args.outputTokens,
      args.cacheReadTokens,
      args.cacheCreationTokens,
      args.contextUsed,
      args.contextLimit,
      args.rateLimitRemaining,
      args.rateLimitResetAt,
      args.model,
      args.costUsd,
      args.raw,
    ],
  );
}

export function listSessionSummaries(limit = 50): SessionSummary[] {
  const db = getDb();
  const sessions = db
    .query<SessionRow, []>(
      `SELECT id, agent, cwd, model, started_at, last_seen_at
       FROM sessions
       ORDER BY last_seen_at DESC
       LIMIT ${limit}`,
    )
    .all();

  const out: SessionSummary[] = [];
  for (const s of sessions) {
    const totals = db
      .query<
        {
          total_input: number | null;
          total_output: number | null;
          total_cache_read: number | null;
          total_cache_creation: number | null;
          total_cost: number | null;
        },
        [string]
      >(
        `SELECT
           SUM(input_tokens) AS total_input,
           SUM(output_tokens) AS total_output,
           SUM(cache_read_tokens) AS total_cache_read,
           SUM(cache_creation_tokens) AS total_cache_creation,
           SUM(cost_usd) AS total_cost
         FROM events WHERE session_id = ?`,
      )
      .get(s.id);
    const last = db
      .query<EventRow, [string]>(
        `SELECT * FROM events WHERE session_id = ? ORDER BY ts DESC LIMIT 1`,
      )
      .get(s.id);
    const contextUsed = last?.context_used ?? 0;
    const contextLimit = last?.context_limit ?? getContextLimit(s.model);
    out.push({
      session: s,
      totalInputTokens: totals?.total_input ?? 0,
      totalOutputTokens: totals?.total_output ?? 0,
      totalCacheReadTokens: totals?.total_cache_read ?? 0,
      totalCacheCreationTokens: totals?.total_cache_creation ?? 0,
      contextUsed,
      contextLimit,
      contextPct: contextLimit > 0 ? (contextUsed / contextLimit) * 100 : 0,
      rateLimitRemaining: last?.rate_limit_remaining ?? null,
      rateLimitResetAt: last?.rate_limit_reset_at ?? null,
      costUsd: totals?.total_cost ?? 0,
      lastEventAt: last?.ts ?? s.last_seen_at,
    });
  }
  return out;
}

export function listEventsBySession(sessionId: string, limit = 200): EventRow[] {
  const db = getDb();
  return db
    .query<EventRow, [string]>(
      `SELECT * FROM events WHERE session_id = ? ORDER BY ts DESC LIMIT ${limit}`,
    )
    .all(sessionId);
}

export function dailyCostSeries(days: number = 14): Array<{ day: string; cost_usd: number; tokens: number }> {
  const db = getDb();
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  return db
    .query<{ day: string; cost_usd: number; tokens: number }, [number]>(
      `SELECT
         strftime('%Y-%m-%d', ts/1000, 'unixepoch', 'localtime') AS day,
         SUM(cost_usd) AS cost_usd,
         SUM(input_tokens + output_tokens + cache_read_tokens + cache_creation_tokens) AS tokens
       FROM events
       WHERE ts >= ?
       GROUP BY day
       ORDER BY day ASC`,
    )
    .all(since);
}

export function totalsAllTime(): { sessions: number; cost_usd: number; tokens: number } {
  const db = getDb();
  const r = db
    .query<{ sessions: number; cost_usd: number; tokens: number }, []>(
      `SELECT
         (SELECT COUNT(*) FROM sessions) AS sessions,
         COALESCE(SUM(cost_usd), 0) AS cost_usd,
         COALESCE(SUM(input_tokens + output_tokens + cache_read_tokens + cache_creation_tokens), 0) AS tokens
       FROM events`,
    )
    .get();
  return r ?? { sessions: 0, cost_usd: 0, tokens: 0 };
}
