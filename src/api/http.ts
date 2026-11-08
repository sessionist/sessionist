// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// HTTP binding of the Query API (store reads go only through api/query.ts), plus the
// SSE activity stream and the player's static assets.

import { createServer, type Server, type ServerResponse } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, sep } from "node:path";
import type { Db } from "../store/db.js";
import {
  getEventPayload,
  getSession,
  listAnnotations,
  listEvents,
  listSessions,
  searchSessions,
  type ListSessionsFilter,
} from "./query.js";
import type { SessionStatus } from "../model/session-event.js";
import { readsSummary, sessionReads } from "./query.js";

export interface ApiServerOptions {
  db: Db;
  dataDir: string;
  version: string;
  /** Directory of built player assets; omitted = API only (dev mode). */
  playerDist?: string;
}

export interface ApiServer {
  server: Server;
  /** Notify live listeners that these sessions changed (assembler hook). */
  broadcastActivity(sessionIds: string[]): void;
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".map": "application/json",
  ".woff2": "font/woff2",
  ".json": "application/json",
};

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
  });
  res.end(JSON.stringify(body));
}

export function createApiServer(options: ApiServerOptions): ApiServer {
  const { db, dataDir, version, playerDist } = options;
  const startedMs = Date.now();
  const streams = new Set<ServerResponse>();

  const pingTimer = setInterval(() => {
    for (const res of streams) res.write(": ping\n\n");
  }, 15_000);
  pingTimer.unref();

  const server = createServer((req, res) => {
    try {
      if (req.method !== "GET") {
        sendJson(res, 405, { error: "read-only API: GET only" });
        return;
      }
      const url = new URL(req.url ?? "/", "http://localhost");
      const path = url.pathname;

      if (path === "/api/health") {
        sendJson(res, 200, { ok: true, version, uptimeMs: Date.now() - startedMs });
        return;
      }

      if (path === "/api/stream") {
        res.writeHead(200, {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          "access-control-allow-origin": "*",
        });
        res.write("retry: 2000\n\n");
        streams.add(res);
        req.on("close", () => streams.delete(res));
        return;
      }

      if (path === "/api/sessions") {
        const filter: ListSessionsFilter = {};
        const service = url.searchParams.get("service");
        if (service !== null) filter.service = service;
        const status = url.searchParams.get("status");
        if (status === "running" || status === "ok" || status === "error") {
          filter.status = status as SessionStatus;
        }
        const since = url.searchParams.get("since");
        if (since !== null) filter.since = since;
        const until = url.searchParams.get("until");
        if (until !== null) filter.until = until;
        const limit = url.searchParams.get("limit");
        if (limit !== null) filter.limit = Number(limit);
        const cursor = url.searchParams.get("cursor");
        if (cursor !== null) filter.cursor = cursor;
        sendJson(res, 200, listSessions(db, filter));
        return;
      }

      if (path === "/api/search") {
        const q = url.searchParams.get("q") ?? "";
        sendJson(res, 200, searchSessions(db, q));
        return;
      }

      const sessionMatch = /^\/api\/sessions\/([^/]+)$/.exec(path);
      if (sessionMatch !== null) {
        const session = getSession(db, decodeURIComponent(sessionMatch[1]!));
        if (session === undefined) {
          sendJson(res, 404, { error: "session not found" });
          return;
        }
        sendJson(res, 200, session);
        return;
      }

      const eventsMatch = /^\/api\/sessions\/([^/]+)\/events$/.exec(path);
      if (eventsMatch !== null) {
        const orderParam = url.searchParams.get("order");
        const opts: Parameters<typeof listEvents>[2] = {};
        if (orderParam === "ts" || orderParam === "seq") opts.order = orderParam;
        const limit = url.searchParams.get("limit");
        if (limit !== null) opts.limit = Number(limit);
        const cursor = url.searchParams.get("cursor");
        if (cursor !== null) opts.cursor = cursor;
        sendJson(res, 200, listEvents(db, decodeURIComponent(eventsMatch[1]!), opts));
        return;
      }

      const payloadMatch = /^\/api\/sessions\/([^/]+)\/events\/(\d+)\/payload$/.exec(path);
      if (payloadMatch !== null) {
        const payload = getEventPayload(
          db,
          dataDir,
          decodeURIComponent(payloadMatch[1]!),
          Number(payloadMatch[2]),
        );
        if (payload === undefined) {
          sendJson(res, 404, { error: "no payload for this event" });
          return;
        }
        sendJson(res, 200, payload);
        return;
      }

      const annotationsMatch = /^\/api\/sessions\/([^/]+)\/annotations$/.exec(path);
      if (annotationsMatch !== null) {
        sendJson(res, 200, {
          annotations: listAnnotations(db, decodeURIComponent(annotationsMatch[1]!)),
        });
        return;
      }

      if (path === "/api/reads") {
        sendJson(res, 200, readsSummary(db));
        return;
      }

      const readsMatch = /^\/api\/sessions\/([^/]+)\/reads$/.exec(path);
      if (readsMatch !== null) {
        sendJson(res, 200, sessionReads(db, decodeURIComponent(readsMatch[1]!)));
        return;
      }

      if (path.startsWith("/api/")) {
        sendJson(res, 404, { error: "not found" });
        return;
      }

      if (playerDist !== undefined) {
        serveStatic(playerDist, path, res);
        return;
      }

      sendJson(res, 404, { error: "not found (player not built; API-only mode)" });
    } catch (err) {
      sendJson(res, 500, { error: err instanceof Error ? err.message : "internal error" });
    }
  });

  return {
    server,
    broadcastActivity(sessionIds: string[]): void {
      if (streams.size === 0) return;
      const frame = `event: activity\ndata: ${JSON.stringify({ sessionIds })}\n\n`;
      for (const res of streams) res.write(frame);
    },
  };
}

function serveStatic(root: string, urlPath: string, res: ServerResponse): void {
  let filePath = normalize(join(root, urlPath));
  if (!filePath.startsWith(root + sep) && filePath !== root) {
    res.writeHead(403).end();
    return;
  }
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    // SPA fallback: deep links like /s/:id/e/:seq resolve to the app shell.
    filePath = join(root, "index.html");
    if (!existsSync(filePath)) {
      res.writeHead(404).end("player not built");
      return;
    }
  }
  res.writeHead(200, { "content-type": MIME[extname(filePath)] ?? "application/octet-stream" });
  createReadStream(filePath).pipe(res);
}
