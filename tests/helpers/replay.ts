// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// Replays fixture batches (raw OTLP request bodies) through the receiver's decode path, the
// normalizer, the assembler, and the store, with deterministic ids and clock.

import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { handleOtlpBody } from "../../src/receiver/server.js";
import { normalizeLogRecord, normalizeSpan } from "../../src/normalize/index.js";
import { Assembler } from "../../src/assemble/assembler.js";
import { SessionStore } from "../../src/store/store.js";
import { openDb, type Db } from "../../src/store/db.js";
import { getEventPayload, listEvents, listSessions } from "../../src/api/query.js";
import type { SessionSummary } from "../../src/model/session-event.js";
import type { TimelineEvent } from "../../src/api/query.js";

export interface FixtureBatch {
  file: string;
  path: string; // OTLP URL path, e.g. /v1/traces
  contentType: string;
  contentEncoding?: string;
  body: Buffer;
}

export function loadFixtureBatches(fixtureDir: string): FixtureBatch[] {
  const batchesDir = join(fixtureDir, "batches");
  const headerFiles = readdirSync(batchesDir)
    .filter((f) => f.endsWith(".headers.json"))
    .sort();
  return headerFiles.map((headerFile) => {
    const meta = JSON.parse(readFileSync(join(batchesDir, headerFile), "utf8")) as {
      path: string;
      headers: Record<string, string>;
    };
    const prefix = headerFile.replace(".headers.json", "");
    const bodyFile = readdirSync(batchesDir).find(
      (f) => f.startsWith(`${prefix}.`) && !f.endsWith(".headers.json"),
    );
    if (bodyFile === undefined) throw new Error(`fixture batch ${prefix} has no body file`);
    const batch: FixtureBatch = {
      file: bodyFile,
      path: meta.path,
      contentType: meta.headers["content-type"] ?? "",
      body: readFileSync(join(batchesDir, bodyFile)),
    };
    const enc = meta.headers["content-encoding"];
    if (enc !== undefined) batch.contentEncoding = enc;
    return batch;
  });
}

export interface PipelineResult {
  sessions: SessionSummary[];
  /** seq-ordered timeline per session id, payloads resolved. */
  timelines: Record<string, (TimelineEvent & { payload?: unknown })[]>;
}

/** Replay a fixture's batches into an existing db/store with deterministic
 *  ids and clock; closes all sessions via a final clock jump past the gap. */
export function replayIntoStore(fixtureDir: string, db: Db, store: SessionStore): void {
  const clock = { now: 1_756_100_000_000 };
  let n = 0;
  const assembler = new Assembler(store, {
    now: () => clock.now,
    newSessionId: () => `fixture-session-${String(++n).padStart(4, "0")}`,
  });
  for (const batch of loadFixtureBatches(fixtureDir)) {
    handleOtlpBody(batch.path, batch.contentType, batch.contentEncoding, batch.body, {
      onSpans: (spans) => assembler.ingest(spans.flatMap((s) => normalizeSpan(s))),
      onLogs: (logs) => assembler.ingest(logs.flatMap((l) => normalizeLogRecord(l))),
    });
    clock.now += 1000; // one second of wall clock between batches
  }
  clock.now += 11 * 60 * 1000;
  assembler.sweep();
}

/** Full-pipeline replay with injected determinism. Sessions close via a final
 *  clock jump past the gap window, so statuses are terminal. */
export function runPipeline(fixtureDir: string): PipelineResult {
  const dataDir = mkdtempSync(join(tmpdir(), "sessionist-replay-"));
  const db = openDb(dataDir);
  try {
    const store = new SessionStore(db, dataDir);
    replayIntoStore(fixtureDir, db, store);

    const sessions = listSessions(db).sessions;
    const timelines: PipelineResult["timelines"] = {};
    for (const session of sessions) {
      timelines[session.id] = listEvents(db, session.id, { order: "seq", limit: 1000 }).events.map(
        (event) => {
          const payload = getEventPayload(db, dataDir, session.id, event.seq);
          return payload === undefined ? event : { ...event, payload };
        },
      );
    }
    return { sessions, timelines };
  } finally {
    db.close();
    rmSync(dataDir, { recursive: true, force: true });
  }
}
