# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] — 2026-05-11

### Added
- TUI dashboard (Ink) — multi-session live view with token / cost / context % / rate-limit
- Web dashboard (Bun + Chart.js) — cost-over-time bar chart, token-mix donut, sessions table, per-session timeline with dual-axis (context %, cumulative cost)
- Claude Code statusline hook ingestion (`agentpulse setup`)
- Codex CLI session ingestion via `codex-import` and live `codex-watch`
- SQLite (WAL) local storage at `~/.agentpulse/agentpulse.db`
- Single-file binary via `bun build --compile` (~59 MB)
- One-line install script (`scripts/install.sh`)
- 4 model pricing tables (Opus 4.7, Sonnet 4.6, Haiku 4.5, GPT-5 / GPT-4o / o3 / o4)
