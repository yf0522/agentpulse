import { Database } from "bun:sqlite";
import { dbPath } from "../lib/paths.ts";

let cached: Database | null = null;

export function getDb(): Database {
  if (cached) return cached;
  const db = new Database(dbPath(), { create: true });
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  migrate(db);
  cached = db;
  return db;
}

function migrate(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      agent TEXT NOT NULL,
      cwd TEXT,
      model TEXT,
      started_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      ts INTEGER NOT NULL,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      cache_read_tokens INTEGER NOT NULL DEFAULT 0,
      cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
      context_used INTEGER NOT NULL DEFAULT 0,
      context_limit INTEGER NOT NULL DEFAULT 200000,
      rate_limit_remaining INTEGER,
      rate_limit_reset_at INTEGER,
      model TEXT,
      cost_usd REAL NOT NULL DEFAULT 0,
      raw TEXT,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_events_session_ts ON events (session_id, ts DESC);
    CREATE INDEX IF NOT EXISTS idx_events_ts ON events (ts DESC);
    CREATE INDEX IF NOT EXISTS idx_sessions_last_seen ON sessions (last_seen_at DESC);
  `);
}
