// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

import Database from "better-sqlite3";
import { mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { MIGRATIONS } from "./migrations.js";

export type Db = Database.Database;

export function dbPath(dataDir: string): string {
  return join(dataDir, "sessions.db");
}

export function openDb(dataDir: string, opts: { readonly?: boolean } = {}): Db {
  mkdirSync(dataDir, { recursive: true });
  const db = new Database(dbPath(dataDir), opts.readonly ? { readonly: true, fileMustExist: true } : {});
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("busy_timeout = 5000");
  db.pragma("foreign_keys = ON");
  if (!opts.readonly) migrate(db);
  return db;
}

/** A database connection that follows the file at its path. A long-lived reader (the MCP
 *  server) otherwise keeps serving a store that was moved or deleted underneath it, since
 *  the open handle pins the old inode. */
export interface DbHandle {
  current(): Db;
  close(): void;
}

export function openDbHandle(dataDir: string): DbHandle {
  const path = dbPath(dataDir);
  let db = openDb(dataDir);
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
        db = openDb(dataDir);
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
  const current = db.pragma("user_version", { simple: true }) as number;
  for (let v = current; v < MIGRATIONS.length; v++) {
    const apply = db.transaction(() => {
      db.exec(MIGRATIONS[v]!);
      db.pragma(`user_version = ${v + 1}`);
    });
    apply();
  }
}
