// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

import { mkdtempSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "../src/store/db.js";
import { MIGRATIONS } from "../src/store/migrations.js";
import { SessionStore } from "../src/store/store.js";
import { getEventPayload, getSession, listEvents, listSessions } from "../src/api/query.js";
import { makeEvent } from "./helpers/make-event.js";

let dir: string;
let db: Db;
let store: SessionStore;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "sessionist-store-"));
  db = openDb(dir);
  store = new SessionStore(db, dir);
});

afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("migrations", () => {
  it("are idempotent across reopens", () => {
    db.close();
    db = openDb(dir); // second open must not re-apply anything
    expect(db.pragma("user_version", { simple: true })).toBe(MIGRATIONS.length);
    expect(
      (db.prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`).all() as { name: string }[]).map(
        (r) => r.name,
      ),
    ).toContain("annotations");
  });

  it("ships the annotations table empty but present", () => {
    const count = db.prepare(`SELECT COUNT(*) AS n FROM annotations`).get() as { n: number };
    expect(count.n).toBe(0);
  });
});

describe("appendEvents", () => {
  it("assigns dense seq across separate append calls", () => {
    store.createSession({ id: "s1", startedAt: "2026-01-01T00:00:00.000000000Z", meta: {} });
    store.appendEvents("s1", [makeEvent(), makeEvent()]);
    const { firstSeq } = store.appendEvents("s1", [makeEvent()]);
    expect(firstSeq).toBe(2);
    const events = listEvents(db, "s1", { order: "seq" }).events;
    expect(events.map((e) => e.seq)).toEqual([0, 1, 2]);
  });

  it("rolls up started_at/ended_at/event_count mechanically", () => {
    store.createSession({ id: "s1", startedAt: "2026-01-01T00:00:05.000000000Z", meta: {} });
    store.appendEvents("s1", [
      makeEvent({ ts: "2026-01-01T00:00:05.000000000Z" }),
      makeEvent({ ts: "2026-01-01T00:00:09.000000000Z" }),
      // out-of-order arrival: earlier ts after later ts
      makeEvent({ ts: "2026-01-01T00:00:01.000000000Z" }),
    ]);
    const s = getSession(db, "s1")!;
    expect(s.eventCount).toBe(3);
    expect(s.startedAt).toBe("2026-01-01T00:00:01.000000000Z");
    expect(s.endedAt).toBe("2026-01-01T00:00:09.000000000Z");
  });

  it("spills payloads over 32KB to content-addressed blobs", () => {
    store.createSession({ id: "s1", startedAt: "2026-01-01T00:00:00.000000000Z", meta: {} });
    const big = "x".repeat(40 * 1024);
    store.appendEvents("s1", [makeEvent({ payload: { input: big } })]);
    const event = listEvents(db, "s1").events[0]!;
    expect(event.payloadRef).toMatch(/^sha256:[0-9a-f]{64}$/);
    const hex = event.payloadRef!.slice("sha256:".length);
    expect(existsSync(join(dir, "blobs", hex.slice(0, 2), `${hex}.json`))).toBe(true);
    // Round-trips through the query layer identically to inline payloads.
    expect(getEventPayload(db, dir, "s1", 0)).toEqual({ input: big });
  });

  it("keeps small payloads inline", () => {
    store.createSession({ id: "s1", startedAt: "2026-01-01T00:00:00.000000000Z", meta: {} });
    store.appendEvents("s1", [makeEvent({ payload: { input: "hi" } })]);
    const event = listEvents(db, "s1").events[0]!;
    expect(event.payloadRef).toBeUndefined();
    expect(event.hasPayload).toBe(true);
    expect(getEventPayload(db, dir, "s1", 0)).toEqual({ input: "hi" });
  });

  it("stores no payload marker when the telemetry had none", () => {
    store.createSession({ id: "s1", startedAt: "2026-01-01T00:00:00.000000000Z", meta: {} });
    store.appendEvents("s1", [makeEvent()]);
    const event = listEvents(db, "s1").events[0]!;
    expect(event.hasPayload).toBe(false);
    expect(getEventPayload(db, dir, "s1", 0)).toBeUndefined();
  });
});

describe("finalizeSession", () => {
  it("closes ok when no event errored", () => {
    store.createSession({ id: "s1", startedAt: "2026-01-01T00:00:00.000000000Z", meta: {} });
    store.appendEvents("s1", [makeEvent({ status: "ok" })]);
    store.finalizeSession("s1", "idle_gap");
    const s = getSession(db, "s1")!;
    expect(s.status).toBe("ok");
    expect((s.meta["sessionist"] as Record<string, unknown>)["close_reason"]).toBe("idle_gap");
  });

  it("closes error when any event errored", () => {
    store.createSession({ id: "s1", startedAt: "2026-01-01T00:00:00.000000000Z", meta: {} });
    store.appendEvents("s1", [makeEvent({ status: "ok" }), makeEvent({ status: "error" })]);
    store.finalizeSession("s1", "idle_gap");
    expect(getSession(db, "s1")!.status).toBe("error");
  });

  it("finalizes exactly once", () => {
    store.createSession({ id: "s1", startedAt: "2026-01-01T00:00:00.000000000Z", meta: {} });
    store.finalizeSession("s1", "idle_gap");
    store.finalizeSession("s1", "second_attempt");
    const s = getSession(db, "s1")!;
    expect((s.meta["sessionist"] as Record<string, unknown>)["close_reason"]).toBe("idle_gap");
  });

  it("late error append flips a finalized ok session to error, never back to running", () => {
    store.createSession({ id: "s1", startedAt: "2026-01-01T00:00:00.000000000Z", meta: {} });
    store.appendEvents("s1", [makeEvent({ status: "ok" })]);
    store.finalizeSession("s1", "idle_gap");
    store.appendEvents("s1", [makeEvent({ status: "error" })]);
    expect(getSession(db, "s1")!.status).toBe("error");
  });
});

describe("listSessions", () => {
  it("filters and paginates newest-first", () => {
    for (let i = 0; i < 5; i++) {
      store.createSession({
        id: `s${i}`,
        startedAt: `2026-01-01T00:0${i}:00.000000000Z`,
        service: i % 2 === 0 ? "even" : "odd",
        meta: {},
      });
    }
    const all = listSessions(db);
    expect(all.sessions.map((s) => s.id)).toEqual(["s4", "s3", "s2", "s1", "s0"]);
    const even = listSessions(db, { service: "even" });
    expect(even.sessions.map((s) => s.id)).toEqual(["s4", "s2", "s0"]);
    const page1 = listSessions(db, { limit: 2 });
    expect(page1.sessions.map((s) => s.id)).toEqual(["s4", "s3"]);
    expect(page1.nextCursor).toBeDefined();
    const page2 = listSessions(db, { limit: 2, cursor: page1.nextCursor! });
    expect(page2.sessions.map((s) => s.id)).toEqual(["s2", "s1"]);
  });
});
