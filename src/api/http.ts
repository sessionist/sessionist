// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// HTTP binding of the Query API (store reads go only through api/query.ts), plus the
// SSE activity stream and the player's static assets.

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
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
import type { UpdateBlock } from "../update/check.js";
import type { RestartOutcome } from "../update/restart.js";
import { readsSummary, sessionReads, storeInfo } from "./query.js";

export interface ApiServerOptions {
  db: Db;
  dataDir: string;
  version: string;
  /** Directory of built player assets; omitted = API only (dev mode). */
  playerDist?: string;
  /** The ports this sink serves on, reported by /api/health so a reader can name them. */
  otlpPort?: number;
  apiPort?: number;
  /** What the daily version check found, for /api/health; absent means the sink does not report it. */
  update?: () => UpdateBlock;
  /** Restart onto the newest release, for POST /api/update; absent means the endpoint answers 503. */
  restart?: (now: boolean) => RestartOutcome;
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

/** Reads answer any origin, since they change nothing; the one action answers only the page this sink serves. */
function sendJson(res: ServerResponse, status: number, body: unknown, anyOrigin = true): void {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (anyOrigin) headers["access-control-allow-origin"] = "*";
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
}

/** A browser cannot send a custom header cross-site without a preflight, and this API answers no OPTIONS,
 *  so the header plus a loopback (or absent) Origin means the request came from the viewer, not a web page. */
function fromThisViewer(req: IncomingMessage): boolean {
  const origin = req.headers.origin;
  const local = origin === undefined || /^http:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(origin);
  return local && req.headers["x-sessionist-action"] === "update";
}

export function createApiServer(options: ApiServerOptions): ApiServer {
  const { db, dataDir, version, playerDist, otlpPort, apiPort, update, restart } = options;
  const startedMs = Date.now();

  function handleUpdate(req: IncomingMessage, res: ServerResponse): void {
    if (!fromThisViewer(req)) {
      sendJson(res, 403, { error: "this action is for the viewer served by this sink" }, false);
      return;
    }
    if (restart === undefined) {
      sendJson(res, 503, { error: "updating is not available in this mode" }, false);
      return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size <= 1024) chunks.push(chunk);
    });
    req.on("end", () => {
      let now = false;
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as { now?: unknown };
        now = body.now === true;
      } catch {
        // a body that is not JSON asks for nothing extra
      }
      const outcome = restart(now);
      sendJson(res, "restarting" in outcome ? 202 : 409, outcome, false);
    });
  }
  const streams = new Set<ServerResponse>();

  const pingTimer = setInterval(() => {
    for (const res of streams) res.write(": ping\n\n");
  }, 15_000);
  pingTimer.unref();

  const server = createServer((req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      const path = url.pathname;

      // The one thing a client may ask this sink to do: restart onto the newest release.
      if (req.method === "POST" && path === "/api/update") {
        handleUpdate(req, res);
        return;
      }
      if (req.method !== "GET") {
        sendJson(res, 405, { error: "read-only API: GET only" });
        return;
      }

      if (path === "/api/health") {
        const health: Record<string, unknown> = { ok: true, version, uptimeMs: Date.now() - startedMs, pid: process.pid };
        if (otlpPort !== undefined) health["otlpPort"] = otlpPort;
        if (apiPort !== undefined) health["apiPort"] = apiPort;
        health["store"] = storeInfo(db, dataDir);
        if (update !== undefined) health["update"] = update();
        sendJson(res, 200, health);
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
