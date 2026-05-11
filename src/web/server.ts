import { listSessionSummaries, listEventsBySession, dailyCostSeries, totalsAllTime } from "../db/store.ts";
import { ASSETS } from "./assets.ts";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export interface ServerOptions {
  port: number;
  openBrowser?: boolean;
}

export async function startServer(opts: ServerOptions) {
  const server = Bun.serve({
    port: opts.port,
    fetch(req) {
      const url = new URL(req.url);
      const path = url.pathname;

      if (path === "/api/totals") return json(totalsAllTime());
      if (path === "/api/sessions") return json(listSessionSummaries(100));
      if (path === "/api/series") {
        const days = Number(url.searchParams.get("days") ?? 14);
        return json(dailyCostSeries(days));
      }
      if (path.startsWith("/api/session/")) {
        const id = decodeURIComponent(path.slice("/api/session/".length));
        const events = listEventsBySession(id, 500);
        const summary = listSessionSummaries(100).find((s) => s.session.id === id);
        return json({ summary, events });
      }

      const asset = ASSETS[path];
      if (asset) {
        return new Response(asset.body, { headers: { "Content-Type": asset.type } });
      }
      return new Response("not found", { status: 404 });
    },
  });

  const url = `http://localhost:${server.port}`;
  console.log(`agentpulse web → ${url}`);
  console.log(`  press ctrl-c to stop`);

  if (opts.openBrowser) {
    try {
      const proc = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
      Bun.spawn([proc, url], { stdout: "ignore", stderr: "ignore" });
    } catch {
      // ignore
    }
  }
}
