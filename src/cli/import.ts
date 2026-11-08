// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

import { readFileSync } from "node:fs";
import { loadConfig } from "../config.js";
import { openDb } from "../store/db.js";
import { SessionStore } from "../store/store.js";
import { parseSessionFile } from "../exporters/session-file.js";
import { extractSessionFromHtml } from "../exporters/session-html.js";

export async function importSession(file: string | undefined, jsonOutput: boolean): Promise<void> {
  if (file === undefined) throw new Error("usage: sessionist import <file.session.jsonl | file.session.html>");
  let content = readFileSync(file, "utf8");
  // An HTML replay is a container around the same session file — unwrap it.
  if (content.trimStart().toLowerCase().startsWith("<!doctype html")) {
    content = extractSessionFromHtml(content);
  }
  const parsed = parseSessionFile(content);
  const config = loadConfig();
  const db = openDb(config.dataDir);
  try {
    const store = new SessionStore(db, config.dataDir);
    store.importSession(parsed.session, parsed.events);
    if (jsonOutput) {
      console.log(JSON.stringify({ sessionId: parsed.session.id, events: parsed.events.length }));
    } else {
      console.log(`imported ${parsed.session.id}  (${parsed.events.length} events)`);
      console.log(`open it: sessionist open ${parsed.session.id}`);
    }
  } finally {
    db.close();
  }
}
