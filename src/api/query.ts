// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// The Query API: the only read path over the store; every client goes through this module.

import type { Db } from "../store/db.js";
import { readBlob } from "../store/blobs.js";
import type {
  EventPayload,
  Provenance,
  SessionEventType,
  SessionStatus,
  SessionSummary,
} from "../model/session-event.js";

/** How much coding agents have read over MCP: an odometer, not a trail. */
export interface ReadsSummary {
  calls: number;
  bytes: number;
  sessions: number;
  firstTs?: string;
  lastTs?: string;
  byClient: { client: string; calls: number; bytes: number; lastTs: string }[];
  byTool: { tool: string; calls: number; bytes: number }[];
}

export function readsSummary(db: Db): ReadsSummary {
  const totals = db
    .prepare(
      `SELECT COUNT(*) AS calls, COALESCE(SUM(bytes), 0) AS bytes, COUNT(DISTINCT session_id) AS sessions,
              MIN(ts) AS first_ts, MAX(ts) AS last_ts FROM reads`,
    )
    .get() as { calls: number; bytes: number; sessions: number; first_ts: string | null; last_ts: string | null };
  const byClient = db
    .prepare(
      `SELECT COALESCE(client, 'unknown') AS client, COUNT(*) AS calls, SUM(bytes) AS bytes, MAX(ts) AS last_ts
       FROM reads GROUP BY COALESCE(client, 'unknown') ORDER BY calls DESC`,
    )
    .all() as { client: string; calls: number; bytes: number; last_ts: string }[];
  const byTool = db
    .prepare(`SELECT tool, COUNT(*) AS calls, SUM(bytes) AS bytes FROM reads GROUP BY tool ORDER BY calls DESC`)
    .all() as { tool: string; calls: number; bytes: number }[];
  const summary: ReadsSummary = {
    calls: totals.calls,
    bytes: totals.bytes,
    sessions: totals.sessions,
    byClient: byClient.map((r) => ({ client: r.client, calls: r.calls, bytes: r.bytes, lastTs: r.last_ts })),
    byTool,
  };
  if (totals.first_ts !== null) summary.firstTs = totals.first_ts;
  if (totals.last_ts !== null) summary.lastTs = totals.last_ts;
  return summary;
}

export interface SessionReads {
  calls: number;
  bytes: number;
  lastTs?: string;
}

export function sessionReads(db: Db, sessionId: string): SessionReads {
  const row = db
    .prepare(`SELECT COUNT(*) AS calls, COALESCE(SUM(bytes), 0) AS bytes, MAX(ts) AS last_ts FROM reads WHERE session_id = ?`)
    .get(sessionId) as { calls: number; bytes: number; last_ts: string | null };
  const out: SessionReads = { calls: row.calls, bytes: row.bytes };
  if (row.last_ts !== null) out.lastTs = row.last_ts;
  return out;
}

export interface ListSessionsFilter {
  service?: string;
  status?: SessionStatus;
  since?: string; // ISO 8601 inclusive lower bound on started_at
  until?: string; // ISO 8601 exclusive upper bound on started_at
  limit?: number;
  cursor?: string;
}

/** Timeline entry: a SessionEvent with the payload replaced by size/ref
 *  metadata so multi-megabyte bodies stay lazily loaded. */
export interface TimelineEvent {
  sessionId: string;
  seq: number;
  ts: string;
  durationMs?: number;
  type: SessionEventType;
  name: string;
  status: "ok" | "error" | "unset";
  attrs: Record<string, unknown>;
  provenance: Provenance;
  hasPayload: boolean;
  payloadBytes?: number;
  payloadRef?: string;
}

interface SessionRow {
  id: string;
  started_at: string;
  ended_at: string | null;
  service: string | null;
  event_count: number;
  status: SessionStatus;
  label: string | null;
  meta: string;
}

interface EventRow {
  session_id: string;
  seq: number;
  ts: string;
  duration_ms: number | null;
  type: SessionEventType;
  name: string;
  status: "ok" | "error" | "unset";
  attrs: string;
  trace_id: string;
  span_id: string;
  dialect: string;
  capture_mode: "otlp" | "proxy";
  payload_json: string | null;
  payload_bytes: number | null;
  payload_ref: string | null;
}

function parseJson(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function rowToSummary(row: SessionRow): SessionSummary {
  const summary: SessionSummary = {
    id: row.id,
    startedAt: row.started_at,
    eventCount: row.event_count,
    status: row.status,
    meta: parseJson(row.meta),
  };
  if (row.ended_at !== null) summary.endedAt = row.ended_at;
  if (row.service !== null) summary.service = row.service;
  if (row.label !== null) summary.label = row.label;
  return summary;
}

function rowToTimelineEvent(row: EventRow): TimelineEvent {
  const event: TimelineEvent = {
    sessionId: row.session_id,
    seq: row.seq,
    ts: row.ts,
    type: row.type,
    name: row.name,
    status: row.status,
    attrs: parseJson(row.attrs),
    provenance: {
      traceId: row.trace_id,
      spanId: row.span_id,
      dialect: row.dialect,
      captureMode: row.capture_mode,
    },
    hasPayload: row.payload_json !== null || row.payload_ref !== null,
  };
  if (row.duration_ms !== null) event.durationMs = row.duration_ms;
  if (row.payload_bytes !== null) event.payloadBytes = row.payload_bytes;
  if (row.payload_ref !== null) event.payloadRef = row.payload_ref;
  return event;
}

export function listSessions(
  db: Db,
  filter: ListSessionsFilter = {},
): { sessions: SessionSummary[]; nextCursor?: string } {
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 500);
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.service !== undefined) {
    where.push("service = ?");
    params.push(filter.service);
  }
  if (filter.status !== undefined) {
    where.push("status = ?");
    params.push(filter.status);
  }
  if (filter.since !== undefined) {
    where.push("started_at >= ?");
    params.push(filter.since);
  }
  if (filter.until !== undefined) {
    where.push("started_at < ?");
    params.push(filter.until);
  }
  if (filter.cursor !== undefined) {
    const sep = filter.cursor.lastIndexOf("|");
    if (sep > 0) {
      where.push("(started_at < ? OR (started_at = ? AND id < ?))");
      const ts = filter.cursor.slice(0, sep);
      const id = filter.cursor.slice(sep + 1);
      params.push(ts, ts, id);
    }
  }
  const sql = `SELECT * FROM sessions
    ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY started_at DESC, id DESC LIMIT ?`;
  const rows = db.prepare(sql).all(...params, limit + 1) as SessionRow[];
  const page = rows.slice(0, limit);
  const result: { sessions: SessionSummary[]; nextCursor?: string } = {
    sessions: page.map(rowToSummary),
  };
  if (rows.length > limit) {
    const last = page[page.length - 1]!;
    result.nextCursor = `${last.started_at}|${last.id}`;
  }
  return result;
}

export function getSession(db: Db, id: string): SessionSummary | undefined {
  const row = db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(id) as SessionRow | undefined;
  return row === undefined ? undefined : rowToSummary(row);
}

export interface ListEventsOptions {
  order?: "ts" | "seq"; // ts = chronological narrative; seq = arrival forensics
  limit?: number;
  cursor?: string;
}

export function listEvents(
  db: Db,
  sessionId: string,
  opts: ListEventsOptions = {},
): { events: TimelineEvent[]; nextCursor?: string } {
  const order = opts.order ?? "ts";
  const limit = Math.min(Math.max(opts.limit ?? 200, 1), 1000);
  let rows: EventRow[];
  if (order === "seq") {
    const after = opts.cursor !== undefined ? Number(opts.cursor) : -1;
    rows = db
      .prepare(`SELECT * FROM events WHERE session_id = ? AND seq > ? ORDER BY seq LIMIT ?`)
      .all(sessionId, Number.isFinite(after) ? after : -1, limit + 1) as EventRow[];
  } else {
    let afterTs = "";
    let afterSeq = -1;
    if (opts.cursor !== undefined) {
      const sep = opts.cursor.lastIndexOf("|");
      if (sep > 0) {
        afterTs = opts.cursor.slice(0, sep);
        afterSeq = Number(opts.cursor.slice(sep + 1));
      }
    }
    rows = db
      .prepare(
        `SELECT * FROM events WHERE session_id = ? AND (ts > ? OR (ts = ? AND seq > ?))
         ORDER BY ts, seq LIMIT ?`,
      )
      .all(sessionId, afterTs, afterTs, afterSeq, limit + 1) as EventRow[];
  }
  const page = rows.slice(0, limit);
  const result: { events: TimelineEvent[]; nextCursor?: string } = {
    events: page.map(rowToTimelineEvent),
  };
  if (rows.length > limit) {
    const last = page[page.length - 1]!;
    result.nextCursor = order === "seq" ? String(last.seq) : `${last.ts}|${last.seq}`;
  }
  return result;
}

export function getEventPayload(
  db: Db,
  dataDir: string,
  sessionId: string,
  seq: number,
): EventPayload | undefined {
  const row = db
    .prepare(`SELECT payload_json, payload_ref FROM events WHERE session_id = ? AND seq = ?`)
    .get(sessionId, seq) as { payload_json: string | null; payload_ref: string | null } | undefined;
  if (row === undefined) return undefined;
  if (row.payload_json !== null) return JSON.parse(row.payload_json) as EventPayload;
  if (row.payload_ref !== null) {
    return JSON.parse(readBlob(dataDir, row.payload_ref)) as EventPayload;
  }
  return undefined;
}

/** Full SessionEvents in seq order with payloads resolved (inline or blob) —
 *  the export read path. Optional inclusive seq range for --steps. */
export function getFullEvents(
  db: Db,
  dataDir: string,
  sessionId: string,
  range?: { from: number; to: number },
): SessionEventFull[] {
  const rows = (
    range !== undefined
      ? db
          .prepare(
            `SELECT * FROM events WHERE session_id = ? AND seq >= ? AND seq <= ? ORDER BY seq`,
          )
          .all(sessionId, range.from, range.to)
      : db.prepare(`SELECT * FROM events WHERE session_id = ? ORDER BY seq`).all(sessionId)
  ) as EventRow[];
  return rows.map((row) => {
    const event: SessionEventFull = {
      sessionId: row.session_id,
      seq: row.seq,
      ts: row.ts,
      type: row.type,
      name: row.name,
      status: row.status,
      attrs: parseJson(row.attrs),
      provenance: {
        traceId: row.trace_id,
        spanId: row.span_id,
        dialect: row.dialect,
        captureMode: row.capture_mode,
      },
    };
    if (row.duration_ms !== null) event.durationMs = row.duration_ms;
    if (row.payload_json !== null) {
      event.payload = JSON.parse(row.payload_json) as Record<string, unknown>;
    } else if (row.payload_ref !== null) {
      event.payload = JSON.parse(readBlob(dataDir, row.payload_ref)) as Record<string, unknown>;
    }
    return event;
  });
}

interface SessionEventFull {
  sessionId: string;
  seq: number;
  ts: string;
  durationMs?: number;
  type: SessionEventType;
  name: string;
  status: "ok" | "error" | "unset";
  attrs: Record<string, unknown>;
  payload?: Record<string, unknown>;
  provenance: Provenance;
}

/** FTS5 search over event names + payload text; sessions newest-first with matching seqs.
 *  User input is quoted per-term so FTS operators can't produce syntax errors. */
export function searchSessions(
  db: Db,
  query: string,
  limit = 50,
): { sessions: (SessionSummary & { matchSeqs: number[] })[] } {
  const terms = query
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .map((t) => `"${t.replaceAll('"', '""')}"`);
  if (terms.length === 0) return { sessions: [] };
  const hits = db
    .prepare(`SELECT session_id, seq FROM events_fts WHERE events_fts MATCH ? ORDER BY rank LIMIT 500`)
    .all(terms.join(" ")) as { session_id: string; seq: number }[];
  const bySession = new Map<string, number[]>();
  for (const hit of hits) {
    let seqs = bySession.get(hit.session_id);
    if (seqs === undefined) bySession.set(hit.session_id, (seqs = []));
    seqs.push(hit.seq);
  }
  const sessions: (SessionSummary & { matchSeqs: number[] })[] = [];
  for (const [sessionId, matchSeqs] of bySession) {
    const summary = getSession(db, sessionId);
    if (summary !== undefined) sessions.push({ ...summary, matchSeqs: matchSeqs.sort((a, b) => a - b) });
  }
  sessions.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
  return { sessions: sessions.slice(0, limit) };
}

export function listAnnotations(
  db: Db,
  sessionId: string,
): { key: string; value: unknown; source: string; ts: string }[] {
  const rows = db
    .prepare(`SELECT key, value, source, ts FROM annotations WHERE session_id = ? ORDER BY ts`)
    .all(sessionId) as { key: string; value: string | null; source: string; ts: string }[];
  return rows.map((r) => ({
    key: r.key,
    value: r.value === null ? null : (JSON.parse(r.value) as unknown),
    source: r.source,
    ts: r.ts,
  }));
}
