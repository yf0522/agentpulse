// agentpulse — web dashboard
const fmt = {
  cost(n) {
    if (!n || n === 0) return "$0";
    if (n < 0.01) return "$" + n.toFixed(4);
    return "$" + n.toFixed(2);
  },
  tokens(n) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
    return String(n || 0);
  },
  ago(ts) {
    const ms = Date.now() - ts;
    const s = Math.round(ms / 1000);
    if (s < 60) return s + "s ago";
    const m = Math.round(s / 60);
    if (m < 60) return m + "m ago";
    const h = Math.round(m / 60);
    if (h < 24) return h + "h ago";
    return Math.round(h / 24) + "d ago";
  },
  short(p) {
    if (!p) return "-";
    return p.replace(/^.*\//, "").slice(0, 22) || p;
  },
  ctxColor(pct) {
    if (pct >= 80) return "red";
    if (pct >= 50) return "yellow";
    return "green";
  },
};

let state = {
  days: 14,
  costChart: null,
  tokenMix: null,
  detailChart: null,
  selectedSessionId: null,
};

async function api(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error("api error " + path);
  return r.json();
}

function renderTotals(t) {
  const el = document.getElementById("totals");
  el.innerHTML = `
    <div class="stat"><span class="label">sessions</span><span class="value">${t.sessions}</span></div>
    <div class="stat"><span class="label">tokens</span><span class="value">${fmt.tokens(t.tokens)}</span></div>
    <div class="stat cost"><span class="label">total cost</span><span class="value">${fmt.cost(t.cost_usd)}</span></div>
  `;
}

function makeCostChart(series) {
  const ctx = document.getElementById("cost-chart");
  if (state.costChart) state.costChart.destroy();
  state.costChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: series.map((d) => d.day.slice(5)),
      datasets: [
        {
          label: "Cost (USD)",
          data: series.map((d) => Number(d.cost_usd ?? 0)),
          backgroundColor: "rgba(176, 114, 255, 0.7)",
          borderColor: "#b072ff",
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (c) => "  " + fmt.cost(c.parsed.y) + "  ·  " + fmt.tokens(series[c.dataIndex].tokens) + " tokens",
          },
        },
      },
      scales: {
        x: { grid: { color: "#232a36" }, ticks: { color: "#8a93a4", font: { family: "ui-monospace" } } },
        y: { grid: { color: "#232a36" }, ticks: { color: "#8a93a4", callback: (v) => "$" + v } },
      },
    },
  });
}

function makeTokenMix(sessions) {
  const ctx = document.getElementById("token-mix");
  if (state.tokenMix) state.tokenMix.destroy();
  const totals = sessions.reduce(
    (acc, s) => {
      acc.input += s.totalInputTokens || 0;
      acc.output += s.totalOutputTokens || 0;
      acc.cacheR += s.totalCacheReadTokens || 0;
      acc.cacheW += s.totalCacheCreationTokens || 0;
      return acc;
    },
    { input: 0, output: 0, cacheR: 0, cacheW: 0 },
  );
  state.tokenMix = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["input", "output", "cache read", "cache write"],
      datasets: [
        {
          data: [totals.input, totals.output, totals.cacheR, totals.cacheW],
          backgroundColor: ["#4cd5ff", "#3ddc97", "#b072ff", "#f6c452"],
          borderWidth: 0,
        },
      ],
    },
    options: {
      cutout: "65%",
      plugins: {
        legend: { position: "bottom", labels: { color: "#8a93a4", font: { size: 11 } } },
        tooltip: { callbacks: { label: (c) => "  " + c.label + ": " + fmt.tokens(c.parsed) } },
      },
    },
  });
}

function renderSessions(sessions) {
  const tbody = document.querySelector("#sessions tbody");
  tbody.innerHTML = "";
  if (sessions.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="dim" style="padding:24px;text-align:center">no data yet — run <code>agentpulse setup</code> or <code>agentpulse seed</code></td></tr>`;
    return;
  }
  for (const s of sessions) {
    const tr = document.createElement("tr");
    const total =
      (s.totalInputTokens || 0) +
      (s.totalOutputTokens || 0) +
      (s.totalCacheReadTokens || 0) +
      (s.totalCacheCreationTokens || 0);
    const pct = Math.min(100, Math.max(0, s.contextPct || 0));
    const col = fmt.ctxColor(pct);
    tr.innerHTML = `
      <td class="session-id">${s.session.id.slice(0, 10)}</td>
      <td class="dim">${s.session.agent}</td>
      <td>${(s.session.model || "-").slice(0, 22)}</td>
      <td class="dim">${fmt.short(s.session.cwd)}</td>
      <td class="num cost">${fmt.cost(s.costUsd)}</td>
      <td class="num">${fmt.tokens(total)}</td>
      <td>
        <span class="ctx-bar"><span class="ctx-fill ${col}" style="width:${pct}%"></span></span>
        <span class="dim">${pct.toFixed(0)}%</span>
      </td>
      <td class="dim">${fmt.ago(s.lastEventAt)}</td>
    `;
    tr.addEventListener("click", () => openDetail(s.session.id));
    tbody.appendChild(tr);
  }
}

async function openDetail(id) {
  state.selectedSessionId = id;
  const data = await api("/api/session/" + encodeURIComponent(id));
  const card = document.getElementById("detail");
  const title = document.getElementById("detail-title");
  const events = document.getElementById("detail-events");
  if (!data.summary) {
    card.hidden = true;
    return;
  }
  card.hidden = false;
  title.textContent = `Session ${data.summary.session.id} · ${data.summary.session.model || "-"}`;

  const reversed = [...data.events].reverse();
  if (state.detailChart) state.detailChart.destroy();
  state.detailChart = new Chart(document.getElementById("detail-chart"), {
    type: "line",
    data: {
      labels: reversed.map((e) => new Date(e.ts).toLocaleTimeString()),
      datasets: [
        {
          label: "context %",
          data: reversed.map((e) => (e.context_used / Math.max(e.context_limit, 1)) * 100),
          borderColor: "#4cd5ff",
          backgroundColor: "rgba(76, 213, 255, 0.15)",
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          yAxisID: "y",
        },
        {
          label: "cumulative cost ($)",
          data: reversed.reduce((acc, e, i) => {
            acc.push((acc[i - 1] || 0) + (e.cost_usd || 0));
            return acc;
          }, []),
          borderColor: "#3ddc97",
          backgroundColor: "rgba(61, 220, 151, 0.1)",
          fill: false,
          tension: 0.3,
          pointRadius: 0,
          yAxisID: "y1",
        },
      ],
    },
    options: {
      responsive: true,
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { labels: { color: "#8a93a4", font: { size: 11 } } } },
      scales: {
        x: { grid: { color: "#232a36" }, ticks: { color: "#8a93a4", maxTicksLimit: 8 } },
        y: {
          position: "left",
          min: 0,
          max: 100,
          grid: { color: "#232a36" },
          ticks: { color: "#4cd5ff", callback: (v) => v + "%" },
        },
        y1: {
          position: "right",
          grid: { drawOnChartArea: false },
          ticks: { color: "#3ddc97", callback: (v) => "$" + v.toFixed(2) },
        },
      },
    },
  });

  events.innerHTML = data.events
    .slice(0, 80)
    .map((e) => {
      const pct = (e.context_used / Math.max(e.context_limit, 1)) * 100;
      return `<div class="ev">
        <span class="time">${new Date(e.ts).toLocaleTimeString()}</span>
        <span class="cost">${fmt.cost(e.cost_usd)}</span>
        <span class="ctx ${fmt.ctxColor(pct)}">${pct.toFixed(0)}%</span>
        <span class="dim">${e.model || "-"}</span>
      </div>`;
    })
    .join("");
  card.scrollIntoView({ behavior: "smooth", block: "start" });
}

document.getElementById("detail-close").addEventListener("click", () => {
  document.getElementById("detail").hidden = true;
  state.selectedSessionId = null;
});

document.querySelectorAll("#range button").forEach((btn) => {
  btn.addEventListener("click", async () => {
    document.querySelectorAll("#range button").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.days = Number(btn.dataset.days);
    const series = await api(`/api/series?days=${state.days}`);
    makeCostChart(series);
  });
});

async function refresh() {
  try {
    const [totals, sessions, series] = await Promise.all([
      api("/api/totals"),
      api("/api/sessions"),
      api(`/api/series?days=${state.days}`),
    ]);
    renderTotals(totals);
    renderSessions(sessions);
    makeCostChart(series);
    makeTokenMix(sessions);
    if (state.selectedSessionId) openDetail(state.selectedSessionId);
  } catch (e) {
    console.error(e);
  }
}

refresh();
setInterval(refresh, 4000);

// Deep-link: ?session=ID or #session=ID auto-opens the detail view.
(function () {
  const params = new URLSearchParams(location.search);
  const fromQuery = params.get("session");
  const fromHash = location.hash.startsWith("#session=") ? location.hash.slice("#session=".length) : null;
  const id = fromQuery || fromHash;
  if (id) setTimeout(() => openDetail(id), 600);
})();
