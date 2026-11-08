// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// Write side of the store (assembler only): events are INSERT-only and session rows receive only
// mechanical rollups; no code path edits, reorders, or deletes committed events.

import type { Db } from "./db.js";
import { PAYLOAD_INLINE_MAX_BYTES, writeBlob } from "./blobs.js";
import type { NormalizedEvent } from "../normalize/types.js";
import type { SessionEvent, SessionStatus, SessionSummary } from "../model/session-event.js";

export interface SessionRowInput {
  id: string;
  startedAt: string;
  service?: string;
  meta: Record<string, unknown>;
}

export interface RecoveredSession {
  id: string;
  service: string | null;
  lastEventTs: string | null;
  traceIds: string[];
  meta: Record<string, unknown>;
}

export class SessionStore {
  constructor(
    private readonly db: Db,
    private readonly dataDir: string,
  ) {}

  createSession(input: SessionRowInput): void {
    this.db
      .prepare(
        `INSERT INTO sessions (id, started_at, service, meta) VALUES (?, ?, ?, ?)`,
      )
      .run(input.id, input.startedAt, input.service ?? null, JSON.stringify(input.meta));
  }

  /** Append events in one transaction: dense seq assigned from event_count,
   *  payload spillover past the inline threshold, mechanical rollups. */
  appendEvents(sessionId: string, events: NormalizedEvent[]): { firstSeq: number } {
    const insert = this.db.prepare(
      `INSERT INTO events (session_id, seq, ts, duration_ms, type, name, status, attrs,
                           trace_id, span_id, dialect, capture_mode,
                           payload_json, payload_bytes, payload_ref)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertFts = this.db.prepare(
      `INSERT INTO events_fts (name, payload, session_id, seq) VALUES (?, ?, ?, ?)`,
    );
    const txn = this.db.transaction((): number => {
      const row = this.db
        .prepare(`SELECT event_count, started_at, ended_at, status FROM sessions WHERE id = ?`)
        .get(sessionId) as
        | { event_count: number; started_at: string; ended_at: string | null; status: SessionStatus }
        | undefined;
      if (!row) throw new Error(`appendEvents: unknown session ${sessionId}`);

      const firstSeq = row.event_count;
      let seq = firstSeq;
      let minTs = row.started_at;
      let maxTs = row.ended_at ?? row.started_at;
      let sawError = false;

      for (const e of events) {
        let payloadJson: string | null = null;
        let payloadBytes: number | null = null;
        let payloadRef: string | null = null;
        let payloadSerialized: string | undefined;
        if (e.payload !== undefined) {
          payloadSerialized = JSON.stringify(e.payload);
          payloadBytes = Buffer.byteLength(payloadSerialized, "utf8");
          if (payloadBytes <= PAYLOAD_INLINE_MAX_BYTES) {
            payloadJson = payloadSerialized;
          } else {
            payloadRef = writeBlob(this.dataDir, payloadSerialized);
          }
        }
        insert.run(
          sessionId,
          seq,
          e.ts,
          e.durationMs ?? null,
          e.type,
          e.name,
          e.status,
          JSON.stringify(e.attrs),
          e.provenance.traceId,
          e.provenance.spanId,
          e.provenance.dialect,
          e.provenance.captureMode,
          payloadJson,
          payloadBytes,
          payloadRef,
        );
        // Full payload text is indexed even when the body spilled to a blob.
        insertFts.run(e.name, payloadSerialized ?? "", sessionId, seq);
        seq++;
        if (e.ts < minTs) minTs = e.ts;
        if (e.ts > maxTs) maxTs = e.ts;
        if (e.status === "error") sawError = true;
      }

      this.db
        .prepare(
          `UPDATE sessions SET event_count = ?, started_at = ?, ended_at = ? WHERE id = ?`,
        )
        .run(seq, minTs, maxTs, sessionId);

      // A late arrival into a finalized session may flip ok -> error, never back to 'running'.
      if (sawError && row.status === "ok") {
        this.db.prepare(`UPDATE sessions SET status = 'error' WHERE id = ?`).run(sessionId);
      }
      return firstSeq;
    });
    return { firstSeq: txn() };
  }

  /** running -> ok|error, exactly once; error iff any committed event has status 'error'. */
  finalizeSession(sessionId: string, closeReason: string): void {
    const txn = this.db.transaction(() => {
      const row = this.db
        .prepare(`SELECT status, ended_at, meta FROM sessions WHERE id = ?`)
        .get(sessionId) as { status: SessionStatus; ended_at: string | null; meta: string } | undefined;
      if (!row || row.status !== "running") return;
      const hasError = this.db
        .prepare(`SELECT 1 FROM events WHERE session_id = ? AND status = 'error' LIMIT 1`)
        .get(sessionId);
      let meta: Record<string, unknown>;
      try {
        meta = JSON.parse(row.meta) as Record<string, unknown>;
      } catch {
        meta = {};
      }
      const ns = (meta["sessionist"] ??= {}) as Record<string, unknown>;
      ns["close_reason"] = closeReason;
      this.db
        .prepare(`UPDATE sessions SET status = ?, meta = ? WHERE id = ?`)
        .run(hasError ? "error" : "ok", JSON.stringify(meta), sessionId);
    });
    txn();
  }

  /** Import a session as parsed from a .session.jsonl: rows are stored verbatim (status, counts,
   *  meta never recomputed) so a re-export is byte-equal. Refuses to overwrite an existing session. */
  importSession(session: SessionSummary, events: SessionEvent[]): void {
    const insert = this.db.prepare(
      `INSERT INTO events (session_id, seq, ts, duration_ms, type, name, status, attrs,
                           trace_id, span_id, dialect, capture_mode,
                           payload_json, payload_bytes, payload_ref)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertFts = this.db.prepare(
      `INSERT INTO events_fts (name, payload, session_id, seq) VALUES (?, ?, ?, ?)`,
    );
    const txn = this.db.transaction(() => {
      const existing = this.db.prepare(`SELECT 1 FROM sessions WHERE id = ?`).get(session.id);
      if (existing !== undefined) {
        throw new Error(`session ${session.id} already exists — sessions are immutable, not overwritten`);
      }
      this.db
        .prepare(
          `INSERT INTO sessions (id, started_at, ended_at, service, event_count, status, label, meta)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          session.id,
          session.startedAt,
          session.endedAt ?? null,
          session.service ?? null,
          session.eventCount,
          session.status,
          session.label ?? null,
          JSON.stringify(session.meta),
        );
      for (const e of events) {
        let payloadJson: string | null = null;
        let payloadBytes: number | null = null;
        let payloadRef: string | null = null;
        let payloadSerialized: string | undefined;
        if (e.payload !== undefined) {
          payloadSerialized = JSON.stringify(e.payload);
          payloadBytes = Buffer.byteLength(payloadSerialized, "utf8");
          if (payloadBytes <= PAYLOAD_INLINE_MAX_BYTES) payloadJson = payloadSerialized;
          else payloadRef = writeBlob(this.dataDir, payloadSerialized);
        }
        insert.run(
          session.id,
          e.seq,
          e.ts,
          e.durationMs ?? null,
          e.type,
          e.name,
          e.status,
          JSON.stringify(e.attrs),
          e.provenance.traceId,
          e.provenance.spanId,
          e.provenance.dialect,
          e.provenance.captureMode,
          payloadJson,
          payloadBytes,
          payloadRef,
        );
        insertFts.run(e.name, payloadSerialized ?? "", session.id, e.seq);
      }
    });
    txn();
  }

  /** Sessions left 'running' by a previous process, for startup recovery. */
  recoverOpenSessions(): RecoveredSession[] {
    const rows = this.db
      .prepare(`SELECT id, service, meta FROM sessions WHERE status = 'running'`)
      .all() as { id: string; service: string | null; meta: string }[];
    return rows.map((row) => {
      const last = this.db
        .prepare(`SELECT MAX(ts) AS ts FROM events WHERE session_id = ?`)
        .get(row.id) as { ts: string | null };
      const traces = this.db
        .prepare(`SELECT DISTINCT trace_id FROM events WHERE session_id = ? AND trace_id != ''`)
        .all(row.id) as { trace_id: string }[];
      let meta: Record<string, unknown>;
      try {
        meta = JSON.parse(row.meta) as Record<string, unknown>;
      } catch {
        meta = {};
      }
      return {
        id: row.id,
        service: row.service,
        lastEventTs: last.ts,
        traceIds: traces.map((t) => t.trace_id),
        meta,
      };
    });
  }
}
