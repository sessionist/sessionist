// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// The HTML replay export must embed a byte-equal session file and make no network requests
// when opened.

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openDb, type Db } from "../src/store/db.js";
import { SessionStore } from "../src/store/store.js";
import { getFullEvents, getSession, listSessions } from "../src/api/query.js";
import { sessionFile, parseSessionFile } from "../src/exporters/session-file.js";
import { sessionHtml, extractSessionFromHtml } from "../src/exporters/session-html.js";
import { replayIntoStore } from "./helpers/replay.js";
import type { SessionEvent, SessionSummary } from "../src/model/session-event.js";

const FIXTURE = join(import.meta.dirname, "..", "fixtures", "spec", "agent-tool-loop");
const PLAYER_BUILT = existsSync(join(import.meta.dirname, "..", "player", "dist", "index.html"));
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

let dir: string;
let db: Db;
let input: { session: SessionSummary; events: SessionEvent[] };
let jsonl: string;
let html: string;

describe.skipIf(!PLAYER_BUILT)("html replay export", () => {
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "sessionist-html-"));
    db = openDb(dir);
    replayIntoStore(FIXTURE, db, new SessionStore(db, dir));
    const sessionId = listSessions(db).sessions[0]!.id;
    input = {
      session: getSession(db, sessionId)!,
      events: getFullEvents(db, dir, sessionId) as SessionEvent[],
    };
    jsonl = sessionFile.export(input);
    html = sessionHtml.export(input);
  });

  afterAll(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("embeds the session file byte-equal — the container carries the contract", () => {
    expect(extractSessionFromHtml(html)).toBe(jsonl);
  });

  it("round-trips: html → import → export → byte-equal session file", () => {
    const parsed = parseSessionFile(extractSessionFromHtml(html));
    const dir2 = mkdtempSync(join(tmpdir(), "sessionist-html-rt-"));
    const db2 = openDb(dir2);
    try {
      new SessionStore(db2, dir2).importSession(parsed.session, parsed.events);
      const again = sessionFile.export({
        session: getSession(db2, parsed.session.id)!,
        events: getFullEvents(db2, dir2, parsed.session.id) as SessionEvent[],
      });
      expect(again).toBe(jsonl);
    } finally {
      db2.close();
      rmSync(dir2, { recursive: true, force: true });
    }
  });

  it("contains no loading construct that references the network", () => {
    // Every <script> is inline (no src attribute at all).
    for (const tag of html.match(/<script[^>]*>/g) ?? []) {
      expect(tag).not.toMatch(/\ssrc\s*=/);
    }
    // Every <link> href is a data: URI (the favicon).
    for (const tag of html.match(/<link[^>]*>/g) ?? []) {
      expect(tag).toMatch(/href="data:/);
    }
    // No CSS imports or remote url() loads.
    const css = /<style>([\s\S]*?)<\/style>/.exec(html)![1]!;
    expect(css).not.toContain("@import");
    expect(css).not.toMatch(/url\(\s*['"]?https?:/);
    // No img/iframe/font/media elements pointing anywhere.
    expect(html).not.toMatch(/<(img|iframe|video|audio|source|embed|object)\b/);
  });

  it("is deterministic — same input, same bytes", () => {
    expect(sessionHtml.export(input)).toBe(html);
  });

  describe.skipIf(!existsSync(CHROME))("under headless Chrome", () => {
    it("renders fully with ALL network blackholed — any connection would fail, and none is needed", { timeout: 60_000 }, () => {
      // Chrome's own services phone home regardless of flags, so instead of watching sockets,
      // every DNS resolution is blackholed and the replay must still render its session.
      const workDir = mkdtempSync(join(tmpdir(), "sessionist-egress-"));
      try {
        const htmlPath = join(workDir, "replay.session.html");
        writeFileSync(htmlPath, html);
        let dom = "";
        try {
          dom = execFileSync(
            CHROME,
            [
              "--headless=new",
              "--disable-gpu",
              `--user-data-dir=${join(workDir, "profile")}`,
              "--no-first-run",
              "--no-default-browser-check",
              "--disable-background-networking",
              '--host-resolver-rules=MAP * ~NOTFOUND',
              "--virtual-time-budget=8000",
              "--timeout=10000",
              "--dump-dom",
              `file://${htmlPath}`,
            ],
            { timeout: 40_000, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
          );
        } catch (err) {
          dom = (err as { stdout?: string }).stdout ?? "";
        }
        expect(dom).toContain('class="wordmark"'); // player booted
        expect(dom).toContain("spec-emitter"); // session decoded + rendered (service name)
        expect(dom).toContain("spec-model"); // timeline populated (model-call step rows)
      } finally {
        rmSync(workDir, { recursive: true, force: true });
      }
    });
  });
});
