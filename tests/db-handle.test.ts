// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// A long-lived reader must follow the store file at its path, not the inode it first opened.
// Found in dogfood: the MCP server kept serving a database that had been moved aside.

import Database from "better-sqlite3";
import { existsSync, mkdtempSync, renameSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../src/mcp/server.js";
import { CURRENT_SCHEMA_VERSION, dbPath, openDb, openDbHandle, schemaVersion } from "../src/store/db.js";
import { MIGRATIONS } from "../src/store/migrations.js";
import { SessionStore } from "../src/store/store.js";

let dir: string;

function seed(id: string): void {
  // A separate short-lived connection, the way the sink would write.
  const db = openDb(dir);
  new SessionStore(db, dir).createSession({ id, startedAt: "2026-01-01T00:00:00.000000000Z", service: "t", meta: {} });
  db.close();
}

function moveStoreAside(): void {
  const path = dbPath(dir);
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      renameSync(path + suffix, join(dir, "old.db" + suffix));
    } catch {
      // -wal/-shm may not exist
    }
  }
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "sessionist-handle-"));
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("openDbHandle", () => {
  it("follows the file when the store is replaced underneath it", () => {
    seed("first");
    const handle = openDbHandle(dir);
    expect(handle.current().prepare("select id from sessions").pluck().all()).toEqual(["first"]);
    const originalIno = statSync(dbPath(dir)).ino;

    moveStoreAside();
    seed("second"); // a fresh file at the same path
    expect(statSync(dbPath(dir)).ino).not.toBe(originalIno);

    expect(handle.current().prepare("select id from sessions").pluck().all()).toEqual(["second"]);
    handle.close();
  });

  it("reopens when the store has been deleted, creating a fresh one", () => {
    const handle = openDbHandle(dir);
    handle.current();
    rmSync(dbPath(dir), { force: true });
    rmSync(dbPath(dir) + "-wal", { force: true });
    rmSync(dbPath(dir) + "-shm", { force: true });
    expect(handle.current().prepare("select count(*) from sessions").pluck().get()).toBe(0);
    expect(existsSync(dbPath(dir))).toBe(true);
    handle.close();
  });

  it("creates a missing store with the current schema, since no sink is writing to a file that does not exist", () => {
    const fresh = mkdtempSync(join(tmpdir(), "sessionist-handle-fresh-"));
    try {
      const handle = openDbHandle(fresh);
      expect(schemaVersion(handle.current())).toBe(CURRENT_SCHEMA_VERSION);
      handle.close();
    } finally {
      rmSync(fresh, { recursive: true, force: true });
    }
  });

  it("never migrates an existing store: an older sink's file is read as it is", () => {
    // A newer reader beside an older sink must not move the schema under the process that owns the file.
    const old = mkdtempSync(join(tmpdir(), "sessionist-handle-old-"));
    try {
      const db = new Database(dbPath(old));
      db.exec(MIGRATIONS[0]!);
      db.pragma("user_version = 1");
      db.close();

      const handle = openDbHandle(old);
      expect(schemaVersion(handle.current())).toBe(1);
      expect(CURRENT_SCHEMA_VERSION).toBeGreaterThan(1);
      handle.close();
      expect(schemaVersion(new Database(dbPath(old), { readonly: true }))).toBe(1);
    } finally {
      rmSync(old, { recursive: true, force: true });
    }
  });
});

describe("MCP server over a handle", () => {
  it("lists the new store's sessions after a reset without restarting", async () => {
    seed("before-reset");
    const handle = openDbHandle(dir);
    const server = createMcpServer(() => handle.current(), dir, "test");
    const client = new Client({ name: "t", version: "0" });
    const [ct, st] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(st), client.connect(ct)]);

    const ids = async (): Promise<string[]> => {
      const r = await client.callTool({ name: "list_sessions", arguments: { service: "t" } });
      const text = (r.content as { text: string }[])[0]!.text;
      return (JSON.parse(text) as { sessions: { id: string }[] }).sessions.map((s) => s.id);
    };

    expect(await ids()).toContain("before-reset");
    moveStoreAside();
    seed("after-reset");
    const after = await ids();
    expect(after).toContain("after-reset");
    expect(after).not.toContain("before-reset");
    handle.close();
  });
});
