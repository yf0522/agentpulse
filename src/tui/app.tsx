import React, { useEffect, useState } from "react";
import { render, Box, Text, useApp, useInput, useStdout } from "ink";
import { listSessionSummaries, listEventsBySession, totalsAllTime } from "../db/store.ts";
import type { SessionSummary, EventRow } from "../lib/types.ts";
import { fmtCost, fmtTokens } from "./format.ts";
import { SessionsView } from "./views/sessions.tsx";
import { DetailView } from "./views/detail.tsx";

type Mode = "list" | "detail";

function App() {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [totals, setTotals] = useState({ sessions: 0, cost_usd: 0, tokens: 0 });
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [mode, setMode] = useState<Mode>("list");
  const [events, setEvents] = useState<EventRow[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const refresh = () => {
      setSessions(listSessionSummaries(50));
      setTotals(totalsAllTime());
    };
    refresh();
    const id = setInterval(() => {
      refresh();
      setTick((t) => t + 1);
    }, 2000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (mode === "detail" && sessions[selectedIdx]) {
      setEvents(listEventsBySession(sessions[selectedIdx].session.id, 50));
    }
  }, [mode, selectedIdx, tick, sessions]);

  useInput((input, key) => {
    if (input === "q" || (key.ctrl && input === "c")) {
      exit();
      return;
    }
    if (mode === "list") {
      if (key.upArrow || input === "k") setSelectedIdx((i) => Math.max(0, i - 1));
      if (key.downArrow || input === "j") setSelectedIdx((i) => Math.min(sessions.length - 1, i + 1));
      if (key.return || input === "l") {
        if (sessions[selectedIdx]) setMode("detail");
      }
    } else if (mode === "detail") {
      if (key.escape || input === "h" || key.leftArrow) setMode("list");
    }
  });

  const width = stdout?.columns ?? 110;

  return (
    <Box flexDirection="column" padding={1}>
      <Box>
        <Text>
          <Text bold color="magenta">agentpulse</Text>
          <Text dimColor>  ·  </Text>
          <Text>{totals.sessions} sessions  </Text>
          <Text color="green">{fmtCost(totals.cost_usd)}</Text>
          <Text>  {fmtTokens(totals.tokens)} tokens</Text>
          <Text dimColor>  ·  refresh 2s  ·  </Text>
          <Text dimColor>{mode === "list" ? "j/k select · enter detail · q quit" : "esc back · q quit"}</Text>
        </Text>
      </Box>
      <Box marginTop={1}>
        {mode === "list" ? (
          <SessionsView sessions={sessions} selectedIdx={selectedIdx} width={width} />
        ) : sessions[selectedIdx] ? (
          <DetailView session={sessions[selectedIdx]} events={events} />
        ) : (
          <Text dimColor>no session selected</Text>
        )}
      </Box>
    </Box>
  );
}

render(<App />);
