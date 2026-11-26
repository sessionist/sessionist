// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// Open, tune, and migrate the store over Node's built-in SQLite; the one place that knows the driver.

import type { DatabaseSync as DatabaseSyncClass } from "node:sqlite";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { MIGRATIONS } from "./migrations.js";

// Resolved at runtime rather than imported: the bundler does not know node:sqlite as a builtin and would
// rewrite the import to a package name.
const { DatabaseSync } = process.getBuiltinModule("node:sqlite") as typeof import("node:sqlite");

export type Db = DatabaseSyncClass;

/** The schema version a fully migrated store carries. */
export const CURRENT_SCHEMA_VERSION = MIGRATIONS.length;

/** How long a connection waits on a lock held by the other process (sink or reader) before failing. */
const BUSY_TIMEOUT_MS = 5000;

/** The Node release whose bundled SQLite first carried full-text search; the store's search table needs it. */
const FTS5_NODE_FLOOR = "22.16.0";

export function dbPath(dataDir: string): string {
  return join(dataDir, "sessions.db");
}

function connect(path: string, readOnly = false): Db {
  const db = new DatabaseSync(path, { readOnly, timeout: BUSY_TIMEOUT_MS, enableForeignKeyConstraints: true });
  if (!readOnly) {
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA synchronous = NORMAL");
    requireFts5(db);
  }
  return db;
}

/** The search table needs FTS5, which Node's bundled SQLite carries only from a certain release; a missing
 *  module is a property of the Node binary, not of the store, so it is named as such before anything is read.
 *  The probe lives in the connection's temp schema and never touches the file. */
function requireFts5(db: Db): void {
  try {
    db.exec("CREATE VIRTUAL TABLE temp.sessionist_fts5_probe USING fts5(x)");
    db.exec("DROP TABLE temp.sessionist_fts5_probe");
  } catch (err) {
    db.close();
    if (err instanceof Error && /no such module: fts5/i.test(err.message)) {
      throw new Error(
        `this Node's built-in SQLite has no full-text search (FTS5); Sessionist needs Node ${FTS5_NODE_FLOOR} or newer (you have ${process.version})`,
      );
    }
    throw err;
  }
}

export function openDb(dataDir: string, opts: { readonly?: boolean } = {}): Db {
  mkdirSync(dataDir, { recursive: true });
  const db = connect(dbPath(dataDir), opts.readonly === true);
  if (!opts.readonly) migrate(db);
  return db;
}

/** The schema version a store carries; 0 before any migration has run. */
export function schemaVersion(db: Db): number {
  const row = db.prepare("PRAGMA user_version").get() as { user_version: number };
  return row.user_version;
}

/** Run `fn` inside one transaction: committed when it returns, rolled back when it throws. Transactions
 *  here never nest. */
export function transaction<T>(db: Db, fn: () => T): T {
  db.exec("BEGIN");
  let result: T;
  try {
    result = fn();
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  db.exec("COMMIT");
  return result;
}

/** A connection that follows the store file at its path and never changes its schema. */
export interface DbHandle {
  current(): Db;
  close(): void;
}

/** An existing store is opened as it is, never migrated: the sink that owns the file may be an older
 *  version still writing to it. A missing store is created, since no sink is writing to a file that does
 *  not exist. The connection also follows the path, because a long-lived process otherwise keeps serving a
 *  store that was moved or deleted underneath it. */
export function openDbHandle(dataDir: string): DbHandle {
  const path = dbPath(dataDir);
  const open = (): Db => (existsSync(path) ? connect(path) : openDb(dataDir));
  let db = open();
  let ino = statSync(path).ino;
  return {
    current() {
      let now: number | undefined;
      try {
        now = statSync(path).ino;
      } catch {
        now = undefined; // removed: reopen creates a fresh store
      }
      if (now !== ino) {
        db.close();
        db = open();
        ino = statSync(path).ino;
      }
      return db;
    },
    close() {
      db.close();
    },
  };
}

export function migrate(db: Db): void {
  const current = schemaVersion(db);
  for (let v = current; v < MIGRATIONS.length; v++) {
    transaction(db, () => {
      db.exec(MIGRATIONS[v]!);
      db.exec(`PRAGMA user_version = ${String(v + 1)}`);
    });
  }
}
