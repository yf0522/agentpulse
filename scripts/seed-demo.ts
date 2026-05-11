#!/usr/bin/env bun
/**
 * Reset the local DB and seed two weeks of plausible-looking sessions across
 * Claude Code and Codex CLI, for richer-looking demo screenshots.
 */
import { unlinkSync, existsSync } from "node:fs";
import { dbPath } from "../src/lib/paths.ts";

const p = dbPath();
if (existsSync(p)) {
  try {
    unlinkSync(p);
  } catch {
    // ignore
  }
}
for (const suffix of ["-wal", "-shm"]) {
  if (existsSync(p + suffix)) {
    try {
      unlinkSync(p + suffix);
    } catch {
      // ignore
    }
  }
}

const { ingest } = await import("../src/collector/ingest.ts");

type Spec = {
  agent: "claude-code" | "codex";
  model: string;
  cwd: string;
  daysAgo: number;
  durationMin: number;
  ticks: number;
  inputBase: number;
  outputBase: number;
  cacheBase: number;
  contextEnd: number;
};

const SPECS: Spec[] = [
  // last 24h — active recent sessions
  { agent: "claude-code", model: "claude-opus-4-7",   cwd: "~/workSpace/agentpulse",       daysAgo: 0,  durationMin: 35, ticks: 28, inputBase: 6000,  outputBase: 1800, cacheBase: 38000, contextEnd: 162000 },
  { agent: "claude-code", model: "claude-sonnet-4-6", cwd: "~/workSpace/cookiy-ai/backend",daysAgo: 0,  durationMin: 22, ticks: 18, inputBase: 3500,  outputBase: 900,  cacheBase: 24000, contextEnd: 88000  },
  { agent: "codex",       model: "gpt-5",              cwd: "~/workSpace/tools/scraper",    daysAgo: 0,  durationMin: 12, ticks: 9,  inputBase: 5000,  outputBase: 1200, cacheBase: 30000, contextEnd: 45000  },

  // yesterday
  { agent: "claude-code", model: "claude-opus-4-7",   cwd: "~/workSpace/agentpulse",       daysAgo: 1,  durationMin: 48, ticks: 36, inputBase: 5800,  outputBase: 1700, cacheBase: 35000, contextEnd: 178000 },
  { agent: "codex",       model: "gpt-5",              cwd: "~/workSpace/cookiy-ai/front-end", daysAgo: 1, durationMin: 28, ticks: 22, inputBase: 4200,  outputBase: 1100, cacheBase: 26000, contextEnd: 96000 },

  // a few days ago
  { agent: "claude-code", model: "claude-sonnet-4-6", cwd: "~/workSpace/cookiy-ai/backend",daysAgo: 2,  durationMin: 18, ticks: 14, inputBase: 3000,  outputBase: 800,  cacheBase: 22000, contextEnd: 64000  },
  { agent: "claude-code", model: "claude-opus-4-7",   cwd: "~/workSpace/tools/scraper",    daysAgo: 3,  durationMin: 26, ticks: 21, inputBase: 5500,  outputBase: 1600, cacheBase: 32000, contextEnd: 142000 },
  { agent: "codex",       model: "o4-mini",            cwd: "~/workSpace/tools",            daysAgo: 4,  durationMin: 15, ticks: 11, inputBase: 4000,  outputBase: 900,  cacheBase: 19000, contextEnd: 38000  },
  { agent: "claude-code", model: "claude-haiku-4-5",  cwd: "~/workSpace/cookiy-ai/limesurvey-plugins", daysAgo: 5, durationMin: 9, ticks: 7,  inputBase: 1800, outputBase: 500, cacheBase: 9000, contextEnd: 22000 },
  { agent: "claude-code", model: "claude-opus-4-7",   cwd: "~/workSpace/autoWork",         daysAgo: 6,  durationMin: 41, ticks: 30, inputBase: 6800,  outputBase: 2100, cacheBase: 42000, contextEnd: 185000 },

  // last week
  { agent: "claude-code", model: "claude-sonnet-4-6", cwd: "~/workSpace/cookiy-ai/backend",daysAgo: 8,  durationMin: 33, ticks: 25, inputBase: 4500,  outputBase: 1200, cacheBase: 28000, contextEnd: 132000 },
  { agent: "codex",       model: "gpt-5",              cwd: "~/workSpace/agentpulse",       daysAgo: 9,  durationMin: 20, ticks: 15, inputBase: 5200,  outputBase: 1400, cacheBase: 27000, contextEnd: 78000 },
  { agent: "claude-code", model: "claude-opus-4-7",   cwd: "~/workSpace/cookiy-ai/front-end", daysAgo: 10, durationMin: 24, ticks: 19, inputBase: 5200, outputBase: 1500, cacheBase: 30000, contextEnd: 118000 },
  { agent: "claude-code", model: "claude-sonnet-4-6", cwd: "~/workSpace/tools/notebook",   daysAgo: 12, durationMin: 16, ticks: 12, inputBase: 3200,  outputBase: 850,  cacheBase: 20000, contextEnd: 56000 },
];

const NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;

let total = 0;
for (const spec of SPECS) {
  const sessionId = `${spec.agent === "codex" ? "cx" : "cc"}-${Math.random().toString(36).slice(2, 10)}`;
  const start = NOW - spec.daysAgo * DAY - spec.durationMin * 60 * 1000;
  for (let i = 0; i < spec.ticks; i++) {
    const ratio = i / Math.max(1, spec.ticks - 1);
    const ts = start + ratio * spec.durationMin * 60 * 1000;
    const jitter = 0.7 + Math.random() * 0.6;
    const input = Math.floor(spec.inputBase * jitter);
    const output = Math.floor(spec.outputBase * jitter);
    const cacheR = Math.floor(spec.cacheBase * jitter);
    const cacheW = Math.floor(spec.cacheBase * 0.18 * jitter);
    const contextUsed = Math.floor(ratio * spec.contextEnd);
    ingest({
      agent: spec.agent,
      sessionId,
      ts,
      cwd: spec.cwd,
      model: spec.model,
      inputTokens: input,
      outputTokens: output,
      cacheReadTokens: cacheR,
      cacheCreationTokens: cacheW,
      contextUsed,
      contextLimit: 200_000,
    });
    total++;
  }
}

console.log(`✓ seeded ${SPECS.length} sessions, ${total} events across 14 days`);
