// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// MCP server: the Query API over stdio, read-only by construction (every tool calls api/query.ts).

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Db } from "../store/db.js";
import {
  getEventPayload,
  getFullEvents,
  getSession,
  listEvents,
  listSessions,
  readsSummary,
  searchSessions,
} from "../api/query.js";
import { recordRead } from "../store/reads.js";
import { getExporter } from "../exporters/index.js";
import type { SessionEvent } from "../model/session-event.js";
import { MCP_INSTRUCTIONS } from "./instructions.js";

const PAYLOAD_CAP_BYTES = 50_000;

function json(value: unknown): { content: { type: "text"; text: string }[] } {
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }] };
}

/** `source` may be a provider so a long-lived server follows a store replaced underneath it. */
export function createMcpServer(source: Db | (() => Db), dataDir: string, version: string): McpServer {
  const db = (): Db => (typeof source === "function" ? source() : source);
  // Each tool description names its neighbours so the reading order survives a client that ignores instructions.
  const server = new McpServer({ name: "sessionist", version }, { instructions: MCP_INSTRUCTIONS });

  // Every tool response is counted in the reads table: which tool, which session and step,
  // how many bytes went back, and which client asked. Size only, never content, and a
  // failure to count must never cost a read.
  function done(tool: string, args: Record<string, unknown>, value: unknown) {
    const result = json(value);
    try {
      const text = result.content.map((c) => c.text).join("");
      const client = server.server.getClientVersion();
      recordRead(db(), {
        ts: new Date().toISOString(),
        client: client === undefined ? undefined : `${client.name} ${client.version}`.trim(),
        tool,
        sessionId: typeof args["sessionId"] === "string" ? args["sessionId"] : undefined,
        seq: typeof args["seq"] === "number" ? args["seq"] : undefined,
        bytes: Buffer.byteLength(text, "utf8"),
        truncated: text.includes('"truncated":true'),
      });
    } catch {
      // the odometer is a courtesy; the read is the job
    }
    return result;
  }

  server.registerTool(
    "list_sessions",
    {
      title: "List sessions",
      description:
        "START HERE to find which run to look at. Recent agent sessions, newest first. Filter by service, status (running|ok|error), ISO time range, or free text (full-text search over payloads); always pass at least one bound rather than listing everything. Next: get_session on the id you pick. Use search_sessions instead when you know a string from the run but not the run.",
      inputSchema: {
        service: z.string().optional(),
        status: z.enum(["running", "ok", "error"]).optional(),
        since: z.string().optional().describe("ISO 8601 lower bound on startedAt"),
        until: z.string().optional().describe("ISO 8601 upper bound on startedAt"),
        text: z.string().optional().describe("full-text search over event names and payloads"),
        limit: z.number().int().min(1).max(200).optional(),
      },
    },
    async (args) => {
      if (args.text !== undefined && args.text !== "") {
        return done("list_sessions", args, searchSessions(db(),args.text, args.limit ?? 50));
      }
      const filter: Parameters<typeof listSessions>[1] = {};
      if (args.service !== undefined) filter.service = args.service;
      if (args.status !== undefined) filter.status = args.status;
      if (args.since !== undefined) filter.since = args.since;
      if (args.until !== undefined) filter.until = args.until;
      if (args.limit !== undefined) filter.limit = args.limit;
      return done("list_sessions", args, listSessions(db(),filter));
    },
  );

  server.registerTool(
    "get_session",
    {
      title: "Get session timeline",
      description:
        "Use after list_sessions or search_sessions identified a run. One session's summary plus its compact event timeline (paginated): seq, ts, type, name, status, durationMs, payload size/ref, one line per step. Read it to locate the step that matters and note its seq, then call get_event_payload with that seq for the body — this tool never returns payload bodies. Leave include_attrs off until one specific step needs its full attributes.",
      inputSchema: {
        sessionId: z.string(),
        order: z.enum(["ts", "seq"]).optional().describe("ts = chronological (default), seq = arrival"),
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(500).optional(),
        include_attrs: z.boolean().optional(),
      },
    },
    async (args) => {
      const session = getSession(db(),args.sessionId);
      if (session === undefined) return done("get_session", args, { error: `no session ${args.sessionId}` });
      const opts: Parameters<typeof listEvents>[2] = { limit: args.limit ?? 100 };
      if (args.order !== undefined) opts.order = args.order;
      if (args.cursor !== undefined) opts.cursor = args.cursor;
      const page = listEvents(db(),args.sessionId, opts);
      const events = page.events.map((e) => {
        const compact: Record<string, unknown> = {
          seq: e.seq,
          ts: e.ts,
          type: e.type,
          name: e.name,
          status: e.status,
        };
        if (e.durationMs !== undefined) compact["durationMs"] = e.durationMs;
        compact["hasPayload"] = e.hasPayload;
        if (e.payloadBytes !== undefined) compact["payloadBytes"] = e.payloadBytes;
        if (e.payloadRef !== undefined) compact["payloadRef"] = e.payloadRef;
        if (args.include_attrs === true) {
          compact["attrs"] = e.attrs;
          compact["provenance"] = e.provenance;
        } else {
          compact["captureMode"] = e.provenance.captureMode;
        }
        return compact;
      });
      const result: Record<string, unknown> = { session, events };
      if (page.nextCursor !== undefined) result["nextCursor"] = page.nextCursor;
      return done("get_session", args, result);
    },
  );

  server.registerTool(
    "get_event_payload",
    {
      title: "Get event payload",
      description:
        "Use after get_session, search_sessions, or export_session identified a step whose exact body you need as evidence. The input/output for one step by seq: the assembled prompt the model received, the tool result it got back. Bodies over the byte cap return truncated:true with totalBytes — raise max_bytes for that one step rather than for the whole session, and say the payload was truncated when you quote it. To see what changed in the model's context between two calls, read the input of each llm_call and compare.",
      inputSchema: {
        sessionId: z.string(),
        seq: z.number().int().min(0),
        max_bytes: z.number().int().min(1000).max(5_000_000).optional(),
      },
    },
    async (args) => {
      const payload = getEventPayload(db(),dataDir, args.sessionId, args.seq);
      if (payload === undefined) {
        return done("get_event_payload", args, { error: "no payload for this event (absent in the telemetry, not hidden)" });
      }
      const cap = args.max_bytes ?? PAYLOAD_CAP_BYTES;
      const serialized = JSON.stringify(payload);
      if (Buffer.byteLength(serialized, "utf8") <= cap) return done("get_event_payload", args, { payload });
      return done("get_event_payload", args, {
        truncated: true,
        totalBytes: Buffer.byteLength(serialized, "utf8"),
        payloadPrefix: serialized.slice(0, cap),
        hint: `call get_event_payload again with max_bytes up to ${Math.min(5_000_000, Buffer.byteLength(serialized, "utf8"))} for the full body`,
      });
    },
  );

  server.registerTool(
    "search_sessions",
    {
      title: "Search sessions",
      description:
        "Use when you know a string from the run — an error message, a tool name, a phrase the model emitted — but not which run or step. Full-text search over event names and payload text (FTS5), returning matching sessions with the seqs of their matching events. Next: get_session for the timeline around a hit, or get_event_payload directly on a returned seq.",
      inputSchema: {
        q: z.string(),
        limit: z.number().int().min(1).max(200).optional(),
      },
    },
    async (args) => done("search_sessions", args, searchSessions(db(),args.q, args.limit ?? 50)),
  );

  server.registerTool(
    "export_session",
    {
      title: "Export session",
      description:
        "Use last, to hand a run to someone or to a later session — not to inspect one (get_session and get_event_payload are cheaper for that). Serializes a session, or a seq range, as a portable artifact: 'session-file' writes .session.jsonl that any agent reads with no server running, lossless and byte-equal on round trip; 'eval-generic' writes a regression case with expected left null for a human to fill in. Returns the content when small, else stats plus the shell command to run instead.",
      inputSchema: {
        sessionId: z.string(),
        exporter: z.enum(["session-file", "eval-generic"]).optional(),
        from_seq: z.number().int().min(0).optional(),
        to_seq: z.number().int().min(0).optional(),
        max_bytes: z.number().int().min(1000).max(5_000_000).optional(),
      },
    },
    async (args) => {
      const session = getSession(db(),args.sessionId);
      if (session === undefined) return done("export_session", args, { error: `no session ${args.sessionId}` });
      const range =
        args.from_seq !== undefined && args.to_seq !== undefined
          ? { from: args.from_seq, to: args.to_seq }
          : undefined;
      const events = getFullEvents(db(),dataDir, args.sessionId, range) as SessionEvent[];
      const exporter = getExporter(args.exporter ?? "session-file")!;
      const content = exporter.export({ session, events });
      const cap = args.max_bytes ?? PAYLOAD_CAP_BYTES;
      if (Buffer.byteLength(content, "utf8") <= cap) {
        return done("export_session", args, { exporter: exporter.name, events: events.length, content });
      }
      return done("export_session", args, {
        exporter: exporter.name,
        events: events.length,
        totalBytes: Buffer.byteLength(content, "utf8"),
        truncated: true,
        hint: `content exceeds ${cap} bytes; run \`sessionist export ${args.sessionId}${exporter.name === "eval-generic" ? " --eval" : ""}\` in a shell, or raise max_bytes / narrow from_seq..to_seq`,
      });
    },
  );

  server.registerTool(
    "reads_summary",
    {
      title: "Reads summary",
      description:
        "How much has been read from this store over MCP, by which client, with which tools, and how many bytes: the human's odometer in the viewer, exposed here so everything the viewer shows is also readable by an agent. Not itself counted. Rarely needed while investigating a run; for that, start with list_sessions.",
      inputSchema: {},
    },
    async () => json(readsSummary(db())),
  );

  return server;
}
