// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// `sessionist list`: reads over HTTP when the daemon is running, else from the query module in-process.

import { existsSync } from "node:fs";
import { loadConfig } from "../config.js";
import { dbPath, openDb } from "../store/db.js";
import { listSessions } from "../api/query.js";
import type { SessionSummary } from "../model/session-event.js";

async function fromDaemon(apiPort: number): Promise<SessionSummary[] | undefined> {
  const base = `http://127.0.0.1:${apiPort}`;
  try {
    const health = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(400) });
    if (!health.ok) return undefined;
    const res = await fetch(`${base}/api/sessions?limit=50`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return undefined;
    const body = (await res.json()) as { sessions: SessionSummary[] };
    return body.sessions;
  } catch {
    return undefined;
  }
}

function fromDisk(dataDir: string): SessionSummary[] {
  if (!existsSync(dbPath(dataDir))) return [];
  const db = openDb(dataDir);
  try {
    return listSessions(db, { limit: 50 }).sessions;
  } finally {
    db.close();
  }
}

function humanTable(sessions: SessionSummary[]): string {
  if (sessions.length === 0) {
    return "No sessions yet. Run `sessionist` and point an OTel-instrumented agent at it.";
  }
  const rows = sessions.map((s) => [
    s.id,
    s.startedAt.slice(0, 19).replace("T", " "),
    s.service ?? "-",
    String(s.eventCount),
    s.status,
  ]);
  const headers = ["ID", "STARTED (UTC)", "SERVICE", "EVENTS", "STATUS"];
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i]!.length)));
  const line = (cells: string[]): string =>
    cells.map((c, i) => c.padEnd(widths[i]!)).join("  ");
  return [line(headers), ...rows.map(line)].join("\n");
}

export async function list(jsonOutput: boolean): Promise<void> {
  const config = loadConfig();
  const sessions = (await fromDaemon(config.apiPort)) ?? fromDisk(config.dataDir);
  if (jsonOutput) {
    console.log(JSON.stringify({ sessions }, null, 2));
  } else {
    console.log(humanTable(sessions));
  }
}
