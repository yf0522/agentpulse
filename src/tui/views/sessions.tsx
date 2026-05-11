import React from "react";
import { Box, Text } from "ink";
import type { SessionSummary } from "../../lib/types.ts";
import { fmtTokens, fmtCost, fmtAgo, progressBar, shortPath, ctxColor } from "../format.ts";

interface Props {
  sessions: SessionSummary[];
  selectedIdx: number;
  width: number;
}

export function SessionsView({ sessions, selectedIdx, width }: Props) {
  if (sessions.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text dimColor>No sessions yet.</Text>
        <Text dimColor>Run </Text>
        <Text>  agentpulse setup</Text>
        <Text dimColor>then start a Claude Code session — data will stream in here.</Text>
        <Text> </Text>
        <Text dimColor>Or seed sample data: </Text>
        <Text>  agentpulse seed</Text>
      </Box>
    );
  }
  return (
    <Box flexDirection="column">
      <Box>
        <Box width={10}><Text bold color="cyan">SESSION</Text></Box>
        <Box width={12}><Text bold color="cyan">AGENT</Text></Box>
        <Box width={20}><Text bold color="cyan">MODEL</Text></Box>
        <Box width={22}><Text bold color="cyan">CWD</Text></Box>
        <Box width={10}><Text bold color="cyan">COST</Text></Box>
        <Box width={10}><Text bold color="cyan">TOKENS</Text></Box>
        <Box width={26}><Text bold color="cyan">CONTEXT</Text></Box>
        <Box><Text bold color="cyan">LAST</Text></Box>
      </Box>
      {sessions.map((s, i) => {
        const total =
          s.totalInputTokens + s.totalOutputTokens + s.totalCacheReadTokens + s.totalCacheCreationTokens;
        const sel = i === selectedIdx;
        const ctx = ctxColor(s.contextPct);
        return (
          <Box key={s.session.id}>
            <Box width={10}>
              <Text color={sel ? "black" : undefined} backgroundColor={sel ? "cyan" : undefined}>
                {sel ? "▸ " : "  "}
                {s.session.id.slice(0, 8)}
              </Text>
            </Box>
            <Box width={12}><Text>{s.session.agent}</Text></Box>
            <Box width={20}><Text>{(s.session.model ?? "-").slice(0, 18)}</Text></Box>
            <Box width={22}><Text dimColor>{shortPath(s.session.cwd).slice(0, 20)}</Text></Box>
            <Box width={10}><Text color="green">{fmtCost(s.costUsd)}</Text></Box>
            <Box width={10}><Text>{fmtTokens(total)}</Text></Box>
            <Box width={26}>
              <Text color={ctx}>{progressBar(s.contextPct, 16)} {s.contextPct.toFixed(0).padStart(3)}%</Text>
            </Box>
            <Box><Text dimColor>{fmtAgo(s.lastEventAt)}</Text></Box>
          </Box>
        );
      })}
    </Box>
  );
}
