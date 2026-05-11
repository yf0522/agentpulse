#!/usr/bin/env bun
/**
 * Generates docs/tui-preview.html — an HTML representation of the live TUI
 * that uses the *actual* SQLite data. Same fixed-width layout, monospace font,
 * unicode block characters. Headless Chrome turns this into a clean PNG.
 *
 * This exists because no terminal-to-PNG tool (vhs/silicon/freeze) is on PATH.
 * Static HTML is the most deterministic capture path.
 */
import { listSessionSummaries, totalsAllTime } from "../src/db/store.ts";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const PALETTE = {
  bg: "#0e1116",
  fg: "#e7ecf3",
  dim: "#7d8694",
  magenta: "#c08bff",
  cyan: "#4cd5ff",
  green: "#3ddc97",
  yellow: "#f6c452",
  red: "#ff6b6b",
};

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return String(n);
}
function fmtCost(n: number) {
  if (n === 0) return "$0";
  if (n < 0.01) return "$" + n.toFixed(4);
  return "$" + n.toFixed(2);
}
function ago(ts: number) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return s + "s ago";
  const m = Math.round(s / 60);
  if (m < 60) return m + "m ago";
  const h = Math.round(m / 60);
  if (h < 24) return h + "h ago";
  return Math.round(h / 24) + "d ago";
}
function bar(pct: number, w = 18) {
  const clamped = Math.max(0, Math.min(100, pct));
  const filled = Math.round((clamped / 100) * w);
  return "█".repeat(filled) + "░".repeat(w - filled);
}
function ctxColor(pct: number): keyof typeof PALETTE {
  if (pct >= 80) return "red";
  if (pct >= 50) return "yellow";
  return "green";
}
function shortPath(p: string | null) {
  if (!p) return "-";
  const parts = p.split("/").filter(Boolean);
  return parts.slice(-2).join("/");
}
function shortModel(m: string | null) {
  return (m ?? "-").slice(0, 20);
}
// Pad string in monospace cells (assumes ASCII / single-cell unicode).
function pad(s: string, w: number): string {
  return s.length >= w ? s : s + " ".repeat(w - s.length);
}

const t = totalsAllTime();
const sessions = listSessionSummaries(8);

const span = (color: keyof typeof PALETTE | "fg", text: string, bold = false) =>
  `<span style="color:${PALETTE[color === "fg" ? "fg" : color]};${bold ? "font-weight:600;" : ""}">${text}</span>`;
const dim = (text: string) => span("dim", text);

// Column widths (each includes a trailing 2-space gutter so columns never touch)
const W = { id: 14, agent: 14, model: 22, cwd: 24, cost: 12, tok: 10, ctx: 30 };

const lines: string[] = [];

// Title bar
lines.push(
  `${span("magenta", "agentpulse", true)}  ${dim("·")}  ${t.sessions} sessions  ${span("green", fmtCost(t.cost_usd), true)}  ${fmt(t.tokens)} tokens  ${dim("·  refresh 2s  ·  j/k select · enter detail · q quit")}`,
);
lines.push("");

// Header row
const headerCells: Array<[string, number]> = [
  ["SESSION", W.id],
  ["AGENT", W.agent],
  ["MODEL", W.model],
  ["CWD", W.cwd],
  ["COST", W.cost],
  ["TOKENS", W.tok],
  ["CONTEXT", W.ctx],
  ["LAST", 0],
];
lines.push(
  headerCells
    .map(([h, w]) => span("cyan", w > 0 ? pad(h, w) : h, true))
    .join(""),
);

// Session rows
sessions.forEach((s, idx) => {
  const total =
    s.totalInputTokens + s.totalOutputTokens + s.totalCacheReadTokens + s.totalCacheCreationTokens;
  const sel = idx === 1; // highlight the codex row as the "selected" demo row
  const ctx = ctxColor(s.contextPct);

  const idCore = `${sel ? "▸ " : "  "}${s.session.id.slice(0, 10)}`;
  const idCellInner = pad(idCore, W.id);
  const idCell = sel
    ? `<span style="background:${PALETTE.cyan};color:#0e1116;font-weight:600;">${idCellInner}</span>`
    : span("fg", idCellInner);

  const cells = [
    idCell,
    span("fg", pad(s.session.agent, W.agent)),
    span("fg", pad(shortModel(s.session.model), W.model)),
    dim(pad(shortPath(s.session.cwd).slice(0, W.cwd - 2), W.cwd)),
    span("green", pad(fmtCost(s.costUsd), W.cost)),
    span("fg", pad(fmt(total), W.tok)),
    span(ctx, pad(`${bar(s.contextPct, 18)} ${s.contextPct.toFixed(0).padStart(3)}%`, W.ctx)),
    dim(ago(s.lastEventAt)),
  ];
  lines.push(cells.join(""));
});

lines.push("");
lines.push(dim("  press q to quit · enter to drill into a session · ←/→ change view"));

const body = lines.join("\n");

const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>agentpulse TUI</title>
<style>
  html,body{margin:0;background:#0a0c10;}
  .term{
    background:${PALETTE.bg};
    color:${PALETTE.fg};
    font-family:"SF Mono","JetBrains Mono","Cascadia Mono",ui-monospace,Menlo,Consolas,monospace;
    font-size:14px;
    line-height:1.55;
    padding:24px 28px 28px;
    border-radius:12px;
    margin:24px;
    width:1280px;
    box-shadow:0 24px 80px rgba(0,0,0,0.6);
    border:1px solid #1f2530;
    white-space:pre;
    overflow:hidden;
  }
  .titlebar{display:flex;gap:6px;padding:0 0 14px 0;}
  .titlebar span{display:inline-block;width:11px;height:11px;border-radius:50%;}
  .titlebar .r{background:#ff6058;}
  .titlebar .y{background:#ffbd2f;}
  .titlebar .g{background:#28ca40;}
</style></head>
<body>
  <div class="term">
    <div class="titlebar"><span class="r"></span><span class="y"></span><span class="g"></span></div>${body}</div>
</body></html>`;

const outDir = join(import.meta.dir, "..", "docs");
const outFile = join(outDir, "tui-preview.html");
writeFileSync(outFile, html);
console.log(`wrote ${outFile}`);
