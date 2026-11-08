// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// The session file format is a public contract: export -> import on a fresh install -> export
// again must be byte-equal.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "../src/store/db.js";
import { SessionStore } from "../src/store/store.js";
import { getFullEvents, getSession, listSessions } from "../src/api/query.js";
import { sessionFile, parseSessionFile } from "../src/exporters/session-file.js";
import { replayIntoStore } from "./helpers/replay.js";
import { makeEvent } from "./helpers/make-event.js";
import type { SessionEvent } from "../src/model/session-event.js";

const FIXTURE = join(import.meta.dirname, "..", "fixtures", "spec", "agent-tool-loop");

let dirA: string;
let dirB: string;
let dbA: Db;
let dbB: Db;

beforeEach(() => {
  dirA = mkdtempSync(join(tmpdir(), "sessionist-rt-a-"));
  dirB = mkdtempSync(join(tmpdir(), "sessionist-rt-b-"));
  dbA = openDb(dirA);
  dbB = openDb(dirB);
});

afterEach(() => {
  dbA.close();
  dbB.close();
  rmSync(dirA, { recursive: true, force: true });
  rmSync(dirB, { recursive: true, force: true });
});

function exportFrom(db: Db, dir: string, sessionId: string): string {
  const session = getSession(db, sessionId)!;
  const events = getFullEvents(db, dir, sessionId) as SessionEvent[];
  return sessionFile.export({ session, events });
}

describe("session file round-trip", () => {
  it("re-exports byte-equal on a fresh store (recorded fixture session)", () => {
    const storeA = new SessionStore(dbA, dirA);
    replayIntoStore(FIXTURE, dbA, storeA);
    const sessionId = listSessions(dbA).sessions[0]!.id;
    const first = exportFrom(dbA, dirA, sessionId);

    const parsed = parseSessionFile(first);
    new SessionStore(dbB, dirB).importSession(parsed.session, parsed.events);
    const second = exportFrom(dbB, dirB, sessionId);

    expect(Buffer.from(second).equals(Buffer.from(first))).toBe(true);
  });

  it("round-trips a spilled (>32KB) payload byte-equal through the blob store", () => {
    const storeA = new SessionStore(dbA, dirA);
    storeA.createSession({ id: "big", startedAt: "2026-01-01T00:00:00.000000000Z", meta: {} });
    storeA.appendEvents("big", [
      makeEvent({ payload: { input: "x".repeat(40 * 1024), output: { deep: [1, 2, 3] } } }),
    ]);
    storeA.finalizeSession("big", "idle_gap");
    const first = exportFrom(dbA, dirA, "big");

    const parsed = parseSessionFile(first);
    new SessionStore(dbB, dirB).importSession(parsed.session, parsed.events);
    const second = exportFrom(dbB, dirB, "big");
    expect(second).toBe(first);
    expect(first.length).toBeGreaterThan(40 * 1024); // payload really is inlined
  });

  it("import preserves every event field the query layer serves", () => {
    const storeA = new SessionStore(dbA, dirA);
    replayIntoStore(FIXTURE, dbA, storeA);
    const sessionId = listSessions(dbA).sessions[0]!.id;
    const parsed = parseSessionFile(exportFrom(dbA, dirA, sessionId));
    new SessionStore(dbB, dirB).importSession(parsed.session, parsed.events);
    expect(getFullEvents(dbB, dirB, sessionId)).toEqual(getFullEvents(dbA, dirA, sessionId));
    expect(getSession(dbB, sessionId)).toEqual(getSession(dbA, sessionId));
  });

  it("refuses to overwrite an existing session", () => {
    const storeA = new SessionStore(dbA, dirA);
    storeA.createSession({ id: "dup", startedAt: "2026-01-01T00:00:00.000000000Z", meta: {} });
    storeA.finalizeSession("dup", "idle_gap");
    const parsed = parseSessionFile(exportFrom(dbA, dirA, "dup"));
    expect(() => storeA.importSession(parsed.session, parsed.events)).toThrow(/immutable/);
  });

  it("rejects unknown format versions", () => {
    expect(() => parseSessionFile('{"format":"sessionist/v99","session":{"id":"x"}}\n')).toThrow(
      /unsupported format/,
    );
  });
});
