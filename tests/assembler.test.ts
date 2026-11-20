// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "../src/store/db.js";
import { SessionStore } from "../src/store/store.js";
import { Assembler } from "../src/assemble/assembler.js";
import { getSession, listEvents, listSessions } from "../src/api/query.js";
import { makeEvent } from "./helpers/make-event.js";

const GAP_MS = 10 * 60 * 1000;

let dir: string;
let db: Db;
let store: SessionStore;
let clock: { now: number };
let assembler: Assembler;

function newAssembler(): Assembler {
  let n = 0;
  return new Assembler(store, {
    gapMs: GAP_MS,
    now: () => clock.now,
    newSessionId: () => `session-${String(++n).padStart(4, "0")}`,
  });
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "sessionist-asm-"));
  db = openDb(dir);
  store = new SessionStore(db, dir);
  clock = { now: 1_000_000 };
  assembler = newAssembler();
});

afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("grouping priority", () => {
  it("groups by gen_ai.conversation.id across different traces", () => {
    assembler.ingest([makeEvent({ conversationId: "conv-1", traceId: "t1" })]);
    assembler.ingest([makeEvent({ conversationId: "conv-1", traceId: "t2" })]);
    const sessions = listSessions(db).sessions;
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.eventCount).toBe(2);
    const meta = sessions[0]!.meta["sessionist"] as Record<string, unknown>;
    expect(meta["grouping_rule"]).toBe("conversation_id");
    expect(meta["group_key"]).toBe("conv:conv-1");
  });

  it("groups by explicit session.id when no conversation id", () => {
    assembler.ingest([makeEvent({ explicitSessionId: "app-sess-9", traceId: "t1" })]);
    assembler.ingest([makeEvent({ explicitSessionId: "app-sess-9", traceId: "t2" })]);
    const sessions = listSessions(db).sessions;
    expect(sessions).toHaveLength(1);
    expect((sessions[0]!.meta["sessionist"] as Record<string, unknown>)["group_key"]).toBe("sess:app-sess-9");
  });

  it("conversation id outranks session id", () => {
    assembler.ingest([makeEvent({ conversationId: "c1", explicitSessionId: "s1", traceId: "t1" })]);
    const sessions = listSessions(db).sessions;
    expect((sessions[0]!.meta["sessionist"] as Record<string, unknown>)["group_key"]).toBe("conv:c1");
  });

  it("binds trace lineage: keyless spans of a known trace join the session", () => {
    assembler.ingest([makeEvent({ conversationId: "conv-1", traceId: "t1" })]);
    assembler.ingest([makeEvent({ traceId: "t1", serviceName: "svc" })]); // no conv id
    const sessions = listSessions(db).sessions;
    expect(sessions).toHaveLength(1);
    const events = listEvents(db, sessions[0]!.id, { order: "seq" }).events;
    expect(events[1]!.attrs["sessionist.group_rule"]).toBe("trace_lineage");
  });

  it("falls back to same-service time window", () => {
    assembler.ingest([makeEvent({ traceId: "t1", serviceName: "my-agent" })]);
    clock.now += 60_000; // within gap
    assembler.ingest([makeEvent({ traceId: "t2", serviceName: "my-agent" })]);
    const sessions = listSessions(db).sessions;
    expect(sessions).toHaveLength(1);
    const events = listEvents(db, sessions[0]!.id, { order: "seq" }).events;
    expect(events[0]!.attrs["sessionist.group_rule"]).toBe("new_session");
    expect(events[1]!.attrs["sessionist.group_rule"]).toBe("time_window");
  });

  it("different services never share a heuristic session", () => {
    assembler.ingest([makeEvent({ traceId: "t1", serviceName: "agent-a" })]);
    assembler.ingest([makeEvent({ traceId: "t2", serviceName: "agent-b" })]);
    expect(listSessions(db).sessions).toHaveLength(2);
  });
});

describe("gap close", () => {
  it("sweep finalizes idle sessions and a new event starts a new session", () => {
    assembler.ingest([makeEvent({ traceId: "t1", serviceName: "svc" })]);
    clock.now += GAP_MS + 1;
    assembler.sweep();
    assembler.ingest([makeEvent({ traceId: "t2", serviceName: "svc" })]);
    const sessions = listSessions(db).sessions;
    expect(sessions).toHaveLength(2);
    const statuses = sessions.map((s) => s.status).sort();
    expect(statuses).toEqual(["ok", "running"]);
  });

  it("a reappearing conversation id after gap close starts a new session", () => {
    assembler.ingest([makeEvent({ conversationId: "c1", traceId: "t1" })]);
    clock.now += GAP_MS + 1;
    assembler.sweep();
    assembler.ingest([makeEvent({ conversationId: "c1", traceId: "t2" })]);
    expect(listSessions(db).sessions).toHaveLength(2);
  });

  it("late spans of a known trace reach the closed session, labeled honestly", () => {
    assembler.ingest([makeEvent({ traceId: "t1", serviceName: "svc" })]);
    clock.now += GAP_MS + 1;
    assembler.sweep(); // closes the session; trace binding survives one extra gap
    assembler.ingest([makeEvent({ traceId: "t1", serviceName: "svc" })]);
    const sessions = listSessions(db).sessions;
    expect(sessions).toHaveLength(1);
    const events = listEvents(db, sessions[0]!.id, { order: "seq" }).events;
    expect(events[1]!.attrs["sessionist.late_arrival"]).toBe(true);
    expect(getSession(db, sessions[0]!.id)!.status).toBe("ok"); // stays finalized
  });
});

describe("recovery", () => {
  it("re-adopts a fresh running session on restart, lineage intact", () => {
    assembler.ingest([
      makeEvent({ traceId: "t1", serviceName: "svc", ts: nowIso() }),
    ]);
    // New process: fresh assembler over the same store.
    const restarted = newAssembler();
    restarted.recover();
    restarted.ingest([makeEvent({ traceId: "t1", serviceName: "svc" })]);
    const sessions = listSessions(db).sessions;
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.eventCount).toBe(2);
    expect(sessions[0]!.status).toBe("running");
  });

  it("finalizes stale running sessions on restart", () => {
    assembler.ingest([makeEvent({ traceId: "t1", serviceName: "svc", ts: "2026-01-01T00:00:00.000000000Z" })]);
    clock.now = Date.parse("2026-01-01T01:00:00Z"); // an hour later
    const restarted = newAssembler();
    restarted.recover();
    const s = listSessions(db).sessions[0]!;
    expect(s.status).toBe("ok");
    expect((s.meta["sessionist"] as Record<string, unknown>)["close_reason"]).toBe("recovered_on_startup");
  });

  function nowIso(): string {
    return new Date(clock.now).toISOString().slice(0, 23) + "000000Z";
  }
});
