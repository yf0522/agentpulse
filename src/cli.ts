#!/usr/bin/env bun
import { ingest, parseClaudeStatusline } from "./collector/ingest.ts";
import { installClaudeStatuslineHook, uninstallClaudeStatuslineHook } from "./collector/setup-hook.ts";
import { listSessionSummaries, totalsAllTime } from "./db/store.ts";
import type { ClaudeStatuslineInput } from "./lib/types.ts";

const CMD = process.argv[2];
const ARGS = process.argv.slice(3);

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtCost(usd: number): string {
  if (usd === 0) return "$0";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    if (process.stdin.isTTY) resolve("");
  });
}

async function cmdHook() {
  const raw = await readStdin();
  if (!raw.trim()) {
    process.stdout.write("agentpulse: no input\n");
    return;
  }
  let parsed: ClaudeStatuslineInput | null = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    process.stdout.write("agentpulse: invalid json\n");
    return;
  }
  if (!parsed) return;
  const payload = parseClaudeStatusline(parsed);
  if (payload) ingest(payload);

  const model = parsed.model?.display_name ?? parsed.model?.id ?? "";
  const cost = parsed.cost?.total_cost_usd ?? 0;
  const dirShort = (parsed.workspace?.current_dir ?? parsed.cwd ?? "")
    .replace(process.env.HOME ?? "", "~")
    .split("/")
    .slice(-2)
    .join("/");
  const ctxFlag = parsed.exceeds_200k_tokens ? " ⚠ 200k+" : "";
  process.stdout.write(`📊 ${model} · ${fmtCost(cost)} · ${dirShort}${ctxFlag}`);
}

function cmdSetup() {
  const binPath = process.argv[1] && process.argv[1].endsWith(".ts")
    ? `bun run ${process.argv[1]}`
    : process.argv[1] || "agentpulse";
  const r = installClaudeStatuslineHook(binPath);
  if (r.changed) {
    console.log(`✓ statusLine hook written to ${r.path}`);
    console.log(`  command: ${binPath} hook`);
    console.log(`\nRestart any running Claude Code session for the hook to take effect.`);
  } else {
    console.log(`✓ already configured at ${r.path}`);
  }
}

function cmdUninstall() {
  const r = uninstallClaudeStatuslineHook();
  if (r.changed) console.log(`✓ removed agentpulse hook from ${r.path}`);
  else console.log(`✓ nothing to remove at ${r.path}`);
}

function cmdStats() {
  const t = totalsAllTime();
  const sessions = listSessionSummaries(20);
  console.log(`\nagentpulse — all-time totals`);
  console.log(`  sessions: ${t.sessions}    cost: ${fmtCost(t.cost_usd)}    tokens: ${fmtTokens(t.tokens)}\n`);
  if (sessions.length === 0) {
    console.log(`  no data yet. run \`agentpulse setup\` then use Claude Code.`);
    return;
  }
  for (const s of sessions) {
    const ago = Math.round((Date.now() - s.lastEventAt) / 60000);
    console.log(
      `  ${s.session.id.slice(0, 8)}  ${s.session.agent.padEnd(11)}  ${(s.session.model ?? "?").slice(0, 22).padEnd(22)}  cost ${fmtCost(s.costUsd).padStart(8)}  ctx ${s.contextPct.toFixed(0).padStart(3)}%  ${ago}m ago`,
    );
  }
}

async function cmdSeed() {
  const { ingest } = await import("./collector/ingest.ts");
  const now = Date.now();
  const sessionA = `seed-${Math.random().toString(36).slice(2, 10)}`;
  const sessionB = `seed-${Math.random().toString(36).slice(2, 10)}`;
  for (let i = 0; i < 24; i++) {
    ingest({
      agent: "claude-code",
      sessionId: sessionA,
      ts: now - i * 5 * 60_000,
      cwd: "~/workSpace/projectA",
      model: "claude-sonnet-4-6",
      inputTokens: Math.floor(Math.random() * 5000),
      outputTokens: Math.floor(Math.random() * 1500),
      cacheReadTokens: Math.floor(Math.random() * 30_000),
      cacheCreationTokens: Math.floor(Math.random() * 8000),
      contextUsed: Math.min(180_000, 20_000 + i * 6_000),
      contextLimit: 200_000,
    });
  }
  for (let i = 0; i < 12; i++) {
    ingest({
      agent: "claude-code",
      sessionId: sessionB,
      ts: now - i * 8 * 60_000,
      cwd: "~/workSpace/projectB",
      model: "claude-opus-4-7",
      inputTokens: Math.floor(Math.random() * 8000),
      outputTokens: Math.floor(Math.random() * 3000),
      cacheReadTokens: Math.floor(Math.random() * 50_000),
      cacheCreationTokens: Math.floor(Math.random() * 15_000),
      contextUsed: Math.min(150_000, 30_000 + i * 9_000),
      contextLimit: 200_000,
      rateLimitRemaining: 40 - i,
      rateLimitResetAt: now + 30 * 60_000,
    });
  }
  console.log(`✓ seeded 2 sessions, 36 events`);
}

async function cmdTui() {
  await import("./tui/app.tsx");
}

async function cmdWeb() {
  const portArg = ARGS.find((a) => a.startsWith("--port="));
  const port = portArg ? Number(portArg.split("=")[1]) : 4757;
  const noOpen = ARGS.includes("--no-open");
  const { startServer } = await import("./web/server.ts");
  await startServer({ port, openBrowser: !noOpen });
}

async function cmdCodexImport() {
  const { ingestCodexFile, ingestCodexDirectory, DEFAULT_CODEX_DIR } = await import("./collector/codex.ts");
  const target = ARGS.find((a) => !a.startsWith("--")) ?? DEFAULT_CODEX_DIR;
  const fs = await import("node:fs");
  if (!fs.existsSync(target)) {
    console.error(`not found: ${target}`);
    process.exit(1);
  }
  const stat = fs.statSync(target);
  if (stat.isDirectory()) {
    const r = ingestCodexDirectory(target);
    console.log(`imported ${r.length} file(s) from ${target}`);
    for (const x of r) console.log(`  ${x.file}  session=${x.sessionId.slice(0, 12)}  events=${x.events}`);
  } else {
    const r = ingestCodexFile(target);
    if (r) console.log(`imported ${r.file}  session=${r.sessionId.slice(0, 12)}  events=${r.events}`);
    else console.log(`no events ingested from ${target}`);
  }
}

async function cmdCodexWatch() {
  const { watchCodexDirectory, DEFAULT_CODEX_DIR } = await import("./collector/codex.ts");
  const dirArg = ARGS.find((a) => a.startsWith("--dir="));
  const dir = dirArg ? dirArg.split("=")[1] : DEFAULT_CODEX_DIR;
  await watchCodexDirectory(dir);
}

function help() {
  console.log(`agentpulse — TUI + Web dashboard for AI coding agents

usage:
  agentpulse setup            install Claude Code statusline hook
  agentpulse uninstall        remove the hook
  agentpulse hook             internal: ingest a statusline payload from stdin
  agentpulse tui              launch the terminal dashboard
  agentpulse web [--port=N]   launch the web dashboard (default :4757)
  agentpulse stats            print a quick text summary
  agentpulse seed             insert sample data for development
  agentpulse codex-import [file|dir]   ingest Codex CLI sessions (default: ~/.codex/sessions)
  agentpulse codex-watch [--dir=PATH]  live-watch Codex sessions directory
  agentpulse help             show this message
`);
}

const main = async () => {
  switch (CMD) {
    case "hook":       return cmdHook();
    case "setup":      return cmdSetup();
    case "uninstall":  return cmdUninstall();
    case "stats":      return cmdStats();
    case "seed":       return cmdSeed();
    case "tui":        return cmdTui();
    case "web":        return cmdWeb();
    case "codex-import": return cmdCodexImport();
    case "codex-watch":  return cmdCodexWatch();
    case "help":
    case undefined:
    case "--help":
    case "-h":         return help();
    default:
      console.error(`unknown command: ${CMD}`);
      help();
      process.exit(1);
  }
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
