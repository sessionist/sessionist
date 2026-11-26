// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// The reads table: one row per MCP tool call. Size of the response, never its content.

import type { Db } from "./db.js";

export interface ReadRow {
  ts: string;
  client?: string | undefined;
  tool: string;
  sessionId?: string | undefined;
  seq?: number | undefined;
  bytes: number;
  truncated: boolean;
  /** The MCP server process that answered. */
  pid?: number | undefined;
}

export function recordRead(db: Db, r: ReadRow): void {
  const values = [r.ts, r.client ?? null, r.tool, r.sessionId ?? null, r.seq ?? null, r.bytes, r.truncated ? 1 : 0];
  try {
    db.prepare(
      `INSERT INTO reads (ts, client, tool, session_id, seq, bytes, truncated, pid) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(...values, r.pid ?? null);
  } catch (err) {
    // An older sink's store has no pid column, and a reader never migrates a store it does not own.
    if (!(err instanceof Error && /no column named pid/i.test(err.message))) throw err;
    db.prepare(
      `INSERT INTO reads (ts, client, tool, session_id, seq, bytes, truncated) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(...values);
  }
}
