// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

import { writeFileSync } from "node:fs";
import { loadConfig } from "../config.js";
import { openDb } from "../store/db.js";
import { getFullEvents, getSession } from "../api/query.js";
import { getExporter } from "../exporters/index.js";
import type { SessionEvent, SessionSummary } from "../model/session-event.js";

export interface ExportArgs {
  sessionId: string;
  out?: string;
  steps?: string; // "a..b"
  exporterName?: string; // default session-file; --eval selects eval-generic
}

function parseSteps(steps: string): { from: number; to: number } {
  const match = /^(\d+)\.\.(\d+)$/.exec(steps);
  if (match === null) throw new Error(`--steps expects "a..b" (got ${JSON.stringify(steps)})`);
  const from = Number(match[1]);
  const to = Number(match[2]);
  if (from > to) throw new Error(`--steps range is backwards: ${steps}`);
  return { from, to };
}

export async function exportSession(args: ExportArgs, jsonOutput: boolean): Promise<void> {
  const config = loadConfig();
  const db = openDb(config.dataDir);
  try {
    const session = getSession(db, args.sessionId);
    if (session === undefined) {
      throw new Error(`no session ${args.sessionId} (see: sessionist list)`);
    }
    const range = args.steps !== undefined ? parseSteps(args.steps) : undefined;
    const events = getFullEvents(db, config.dataDir, args.sessionId, range) as SessionEvent[];

    let header: SessionSummary = session;
    if (range !== undefined) {
      // Counts reflect the clip, and the range is recorded under the sessionist namespace.
      const meta = structuredClone(session.meta);
      const ns = (meta["sessionist"] ??= {}) as Record<string, unknown>;
      ns["export_range"] = `${range.from}..${range.to}`;
      header = { ...session, eventCount: events.length, meta };
    }

    const exporter = getExporter(args.exporterName ?? "session-file");
    if (exporter === undefined) {
      throw new Error(`unknown exporter ${args.exporterName ?? "session-file"}`);
    }
    const content = exporter.export({ session: header, events });
    const outPath = args.out ?? `${args.sessionId}.${exporter.extension}`;
    writeFileSync(outPath, content);
    if (jsonOutput) {
      console.log(JSON.stringify({ path: outPath, events: events.length, exporter: exporter.name }));
    } else {
      console.log(`${outPath}  (${events.length} events, ${exporter.name})`);
    }
  } finally {
    db.close();
  }
}
