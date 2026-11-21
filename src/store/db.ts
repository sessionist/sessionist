// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

import Database from "better-sqlite3";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { MIGRATIONS } from "./migrations.js";

export type Db = Database.Database;

/** The schema version a fully migrated store carries. */
export const CURRENT_SCHEMA_VERSION = MIGRATIONS.length;

export function dbPath(dataDir: string): string {
  return join(dataDir, "sessions.db");
}

function tune(db: Db): void {
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("busy_timeout = 5000");
  db.pragma("foreign_keys = ON");
}

export function openDb(dataDir: string, opts: { readonly?: boolean } = {}): Db {
  mkdirSync(dataDir, { recursive: true });
  const db = new Database(dbPath(dataDir), opts.readonly ? { readonly: true, fileMustExist: true } : {});
  tune(db);
  if (!opts.readonly) migrate(db);
  return db;
}

/** The schema version a store carries; 0 before any migration has run. */
export function schemaVersion(db: Db): number {
  return db.pragma("user_version", { simple: true }) as number;
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
  const open = (): Db => {
    if (existsSync(path)) {
      const db = new Database(path);
      tune(db);
      return db;
    }
    return openDb(dataDir);
  };
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
    const apply = db.transaction(() => {
      db.exec(MIGRATIONS[v]!);
      db.pragma(`user_version = ${v + 1}`);
    });
    apply();
  }
}
