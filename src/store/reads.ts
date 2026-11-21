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
}

export function recordRead(db: Db, r: ReadRow): void {
  db.prepare(
    `INSERT INTO reads (ts, client, tool, session_id, seq, bytes, truncated) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(r.ts, r.client ?? null, r.tool, r.sessionId ?? null, r.seq ?? null, r.bytes, r.truncated ? 1 : 0);
}
