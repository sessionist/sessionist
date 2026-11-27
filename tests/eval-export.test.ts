// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "../src/store/db.js";
import { SessionStore } from "../src/store/store.js";
import { getFullEvents, getSession, listSessions } from "../src/api/query.js";
import { evalGeneric } from "../src/exporters/eval-generic.js";
import { getExporter } from "../src/exporters/index.js";
import { replayIntoStore } from "./helpers/replay.js";
import type { SessionEvent } from "../src/model/session-event.js";

const FIXTURE = join(import.meta.dirname, "..", "fixtures", "spec", "agent-tool-loop");

let dir: string;
let db: Db;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "sessionist-eval-"));
  db = openDb(dir);
  replayIntoStore(FIXTURE, db, new SessionStore(db, dir));
});

afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("eval-generic exporter", () => {
  it("is registered in the exporter registry", () => {
    expect(getExporter("eval-generic")?.name).toBe("eval-generic");
  });

  it("emits the generic case shape with expected always null", () => {
    const sessionId = listSessions(db).sessions[0]!.id;
    const session = getSession(db, sessionId)!;
    const events = getFullEvents(db, dir, sessionId) as SessionEvent[];
    const doc = JSON.parse(evalGeneric.export({ session, events })) as Record<string, unknown>;

    expect(doc["format"]).toBe("sessionist-eval/v1");
    expect(doc["expected"]).toBeNull(); // a human decides what correct is
    expect(doc["input"]).not.toBeNull(); // this fixture captured content
    expect(Array.isArray(doc["trajectory"])).toBe(true);
    expect((doc["trajectory"] as unknown[]).length).toBe(events.length);
    const source = doc["source"] as Record<string, unknown>;
    expect(source["sessionId"]).toBe(sessionId);
    expect(source["steps"]).toBe(`${events[0]!.seq}..${events[events.length - 1]!.seq}`);
  });

  it("is deterministic", () => {
    const sessionId = listSessions(db).sessions[0]!.id;
    const session = getSession(db, sessionId)!;
    const events = getFullEvents(db, dir, sessionId) as SessionEvent[];
    expect(evalGeneric.export({ session, events })).toBe(evalGeneric.export({ session, events }));
  });
});
