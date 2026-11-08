// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// Ordered migrations, applied at open in one transaction each, guarded by PRAGMA user_version;
// schema evolution is additive-only.

export const MIGRATIONS: string[] = [
  // v1 — core schema. Events are INSERT-only; session rows receive only mechanical rollups
  // (ended_at, event_count, status, meta). Derived data goes in annotations, never in events.
  `
  CREATE TABLE sessions (
    id            TEXT PRIMARY KEY,
    started_at    TEXT NOT NULL,
    ended_at      TEXT,
    service       TEXT,
    event_count   INTEGER NOT NULL DEFAULT 0,
    status        TEXT NOT NULL DEFAULT 'running'
                  CHECK (status IN ('running','ok','error')),
    label         TEXT,
    meta          TEXT NOT NULL DEFAULT '{}'
  );
  CREATE INDEX idx_sessions_started ON sessions (started_at DESC);
  CREATE INDEX idx_sessions_service_started ON sessions (service, started_at DESC);
  CREATE INDEX idx_sessions_running ON sessions (status) WHERE status = 'running';

  CREATE TABLE events (
    session_id    TEXT NOT NULL REFERENCES sessions(id),
    seq           INTEGER NOT NULL,
    ts            TEXT NOT NULL,
    duration_ms   REAL,
    type          TEXT NOT NULL,
    name          TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'unset' CHECK (status IN ('ok','error','unset')),
    attrs         TEXT NOT NULL DEFAULT '{}',
    trace_id      TEXT NOT NULL,
    span_id       TEXT NOT NULL,
    dialect       TEXT NOT NULL,
    capture_mode  TEXT NOT NULL DEFAULT 'otlp' CHECK (capture_mode IN ('otlp','proxy')),
    payload_json  TEXT,
    payload_bytes INTEGER,
    payload_ref   TEXT,
    PRIMARY KEY (session_id, seq)
  ) WITHOUT ROWID;
  CREATE INDEX idx_events_ts ON events (session_id, ts, seq);
  CREATE INDEX idx_events_trace ON events (trace_id);
  CREATE INDEX idx_events_error ON events (session_id, seq) WHERE status = 'error';

  -- Derived data from store consumers, keyed by a namespaced source.
  CREATE TABLE annotations (
    session_id    TEXT NOT NULL REFERENCES sessions(id),
    key           TEXT NOT NULL,
    value         TEXT,
    source        TEXT NOT NULL,
    ts            TEXT NOT NULL
  );
  CREATE INDEX idx_annotations_session ON annotations (session_id, key);
  `,

  // v2 — full-text search over payloads. New events index their full serialized payload, spilled
  // or not; pre-v2 events are backfilled from inline payloads only (blob bodies are not re-read).
  `
  CREATE VIRTUAL TABLE events_fts USING fts5(
    name,
    payload,
    session_id UNINDEXED,
    seq UNINDEXED
  );
  INSERT INTO events_fts (name, payload, session_id, seq)
    SELECT name, COALESCE(payload_json, ''), session_id, seq FROM events;
  `,

  // v3 — reads: one row per MCP tool call, the odometer of how much coding agents have read.
  // Never touches events; bytes is the size of the response, never its content.
  `
  CREATE TABLE reads (
    id INTEGER PRIMARY KEY,
    ts TEXT NOT NULL,
    client TEXT,
    tool TEXT NOT NULL,
    session_id TEXT,
    seq INTEGER,
    bytes INTEGER NOT NULL,
    truncated INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX idx_reads_ts ON reads (ts);
  CREATE INDEX idx_reads_session ON reads (session_id);
  `,
];
