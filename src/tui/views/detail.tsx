import React from "react";
import { Box, Text } from "ink";
import type { SessionSummary, EventRow } from "../../lib/types.ts";
import { fmtTokens, fmtCost, fmtAgo, progressBar, shortPath, ctxColor } from "../format.ts";

interface Props {
  session: SessionSummary;
  events: EventRow[];
}

export function DetailView({ session, events }: Props) {
  const s = session;
  const total =
    s.totalInputTokens + s.totalOutputTokens + s.totalCacheReadTokens + s.totalCacheCreationTokens;
  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="column">
        <Text bold color="cyan">Session {s.session.id}</Text>
        <Text dimColor>
          {s.session.agent} · {s.session.model ?? "-"} · {shortPath(s.session.cwd)}
        </Text>
      </Box>
      <Box flexDirection="row" gap={3}>
        <StatBlock label="cost" value={fmtCost(s.costUsd)} color="green" />
        <StatBlock label="total tokens" value={fmtTokens(total)} />
        <StatBlock label="input" value={fmtTokens(s.totalInputTokens)} />
        <StatBlock label="output" value={fmtTokens(s.totalOutputTokens)} />
        <StatBlock label="cache R" value={fmtTokens(s.totalCacheReadTokens)} />
        <StatBlock label="cache W" value={fmtTokens(s.totalCacheCreationTokens)} />
      </Box>
      <Box flexDirection="column">
        <Text>
          context  <Text color={ctxColor(s.contextPct)}>{progressBar(s.contextPct, 30)} {s.contextPct.toFixed(1)}%</Text>
          {"  "}
          <Text dimColor>({fmtTokens(s.contextUsed)} / {fmtTokens(s.contextLimit)})</Text>
        </Text>
        {s.rateLimitRemaining !== null && (
          <Text>
            rate-limit  <Text color={s.rateLimitRemaining < 10 ? "red" : "yellow"}>{s.rateLimitRemaining} reqs left</Text>
            {s.rateLimitResetAt && (
              <Text dimColor>{"  "} resets {fmtAgo(s.rateLimitResetAt)}</Text>
            )}
          </Text>
        )}
      </Box>
      <Box flexDirection="column">
        <Text bold color="cyan">recent events</Text>
        {events.length === 0 && <Text dimColor>  none</Text>}
        {events.slice(0, 10).map((e) => (
          <Text key={e.id}>
            {"  "}{new Date(e.ts).toLocaleTimeString()}  cost <Text color="green">{fmtCost(e.cost_usd).padStart(8)}</Text>
            {"  "}ctx <Text color={ctxColor((e.context_used / Math.max(e.context_limit, 1)) * 100)}>
              {((e.context_used / Math.max(e.context_limit, 1)) * 100).toFixed(0).padStart(3)}%
            </Text>
            {"  "}<Text dimColor>{e.model ?? "-"}</Text>
          </Text>
        ))}
      </Box>
    </Box>
  );
}

function StatBlock({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Box flexDirection="column">
      <Text dimColor>{label}</Text>
      <Text bold color={color}>{value}</Text>
    </Box>
  );
}
