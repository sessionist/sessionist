// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// The reads odometer: every MCP tool response is counted by size, client, tool, session and
// step; the count never touches events and never stores content.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { DatabaseSync } from "node:sqlite";
import { createMcpServer } from "../src/mcp/server.js";
import { dbPath, openDb, openDbHandle, schemaVersion, type Db } from "../src/store/db.js";
import { MIGRATIONS } from "../src/store/migrations.js";
import { SessionStore } from "../src/store/store.js";
import { recordRead } from "../src/store/reads.js";
import { readsSummary, recentReaders, sessionReads } from "../src/api/query.js";
import { makeEvent } from "./helpers/make-event.js";

let dir: string;
let db: Db;
let client: Client;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "sessionist-reads-"));
  db = openDb(dir);
  const store = new SessionStore(db, dir);
  store.createSession({ id: "s1", startedAt: "2026-01-01T00:00:00.000000000Z", service: "t", meta: {} });
  store.appendEvents("s1", [
    makeEvent({ ts: "2026-01-01T00:00:01.000000000Z", type: "llm_call", status: "ok", payload: { input: "hi" } }),
  ]);
  store.finalizeSession("s1", "test");

  const server = createMcpServer({
    source: db,
    dataDir: dir,
    version: "test",
    info: {
      otlpPort: 1,
      apiPort: 2,
      sink: async () => undefined,
      service: () => ({ supported: false, platform: "test" as NodeJS.Platform, installed: false }),
      updateCommand: "x update",
    },
  });
  client = new Client({ name: "odometer-test", version: "9.9" });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(st), client.connect(ct)]);
});

afterAll(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("the reads table", () => {
  it("starts empty and sums what it is given", () => {
    const before = readsSummary(db);
    recordRead(db, { ts: "2026-02-01T00:00:00.000Z", client: "x 1", tool: "get_session", sessionId: "s1", bytes: 100, truncated: false });
    recordRead(db, { ts: "2026-02-01T00:00:05.000Z", client: "x 1", tool: "get_event_payload", sessionId: "s1", seq: 0, bytes: 250, truncated: true });
    const after = readsSummary(db);
    expect(after.calls - before.calls).toBe(2);
    expect(after.bytes - before.bytes).toBe(350);
    expect(after.byClient.find((c) => c.client === "x 1")?.calls).toBe(2);
    expect(after.byTool.find((t) => t.tool === "get_event_payload")?.bytes).toBe(250);
    expect(sessionReads(db, "s1").calls).toBeGreaterThanOrEqual(2);
    expect(sessionReads(db, "none").calls).toBe(0);
  });
});

describe("the MCP server counts its own responses", () => {
  it("records one read per tool call with the client's name and the response size", async () => {
    const before = readsSummary(db).calls;
    const result = await client.callTool({ name: "get_session", arguments: { sessionId: "s1" } });
    const text = (result.content as { text: string }[])[0]!.text;
    const after = readsSummary(db);
    expect(after.calls - before).toBe(1);
    const mine = after.byClient.find((c) => c.client.startsWith("odometer-test"));
    expect(mine).toBeDefined();
    expect(mine!.client).toBe("odometer-test 9.9");
    const perSession = sessionReads(db, "s1");
    expect(perSession.bytes).toBeGreaterThanOrEqual(Buffer.byteLength(text, "utf8"));
  });

  it("records the step for a payload read, and the PID of the server that answered", async () => {
    await client.callTool({ name: "get_event_payload", arguments: { sessionId: "s1", seq: 0 } });
    const row = db.prepare(`SELECT tool, session_id, seq, bytes, pid FROM reads ORDER BY id DESC LIMIT 1`).get() as {
      tool: string;
      session_id: string;
      seq: number;
      bytes: number;
      pid: number;
    };
    expect(row.tool).toBe("get_event_payload");
    expect(row.session_id).toBe("s1");
    expect(row.seq).toBe(0);
    expect(row.bytes).toBeGreaterThan(0);
    expect(row.pid).toBe(process.pid);
    const mine = recentReaders(db, "2000-01-01T00:00:00Z").find((r) => r.pid === process.pid);
    expect(mine?.client).toBe("odometer-test 9.9");
  });

  it("still counts on an older sink's store that has no pid column, since a reader never migrates it", () => {
    const old = mkdtempSync(join(tmpdir(), "sessionist-reads-old-"));
    try {
      const writer = new DatabaseSync(dbPath(old));
      for (const sql of MIGRATIONS.slice(0, 3)) writer.exec(sql);
      writer.exec("PRAGMA user_version = 3");
      writer.close();

      const handle = openDbHandle(old);
      const reader = handle.current();
      expect(schemaVersion(reader)).toBe(3);
      recordRead(reader, { ts: "2026-02-01T00:00:00.000Z", client: "c 1", tool: "get_session", bytes: 10, truncated: false, pid: 123 });
      expect(readsSummary(reader).calls).toBe(1);
      const cols = (reader.prepare(`PRAGMA table_info(reads)`).all() as { name: string }[]).map((c) => c.name);
      expect(cols).not.toContain("pid");
      expect(recentReaders(reader, "2000-01-01T00:00:00Z")).toEqual([
        { client: "c 1", calls: 1, lastTs: "2026-02-01T00:00:00.000Z" },
      ]);
      handle.close();
    } finally {
      rmSync(old, { recursive: true, force: true });
    }
  });

  it("does not count reads_summary or sessionist_info, and never stores response content", async () => {
    const before = readsSummary(db).calls;
    const r = await client.callTool({ name: "reads_summary", arguments: {} });
    const summary = JSON.parse((r.content as { text: string }[])[0]!.text) as { calls: number };
    expect(summary.calls).toBe(before);
    await client.callTool({ name: "sessionist_info", arguments: {} });
    expect(readsSummary(db).calls).toBe(before);
    const cols = (db.prepare(`PRAGMA table_info(reads)`).all() as { name: string }[]).map((c) => c.name);
    expect(cols).not.toContain("content");
    expect(cols).not.toContain("payload");
  });

  it("never touches events", async () => {
    const count = (): number => (db.prepare(`SELECT COUNT(*) AS n FROM events`).get() as { n: number }).n;
    const eventsBefore = count();
    await client.callTool({ name: "list_sessions", arguments: { service: "t" } });
    await client.callTool({ name: "search_sessions", arguments: { q: "hi" } });
    expect(count()).toBe(eventsBefore);
  });
});
