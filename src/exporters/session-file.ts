// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// The .session.jsonl format: line 1 is a header object, then one SessionEvent per line in seq
// order, payloads inlined, UTF-8/LF. Export -> import -> export must stay byte-equal.

export const SESSION_FILE_FORMAT = "sessionist/v1";

import type { SessionEvent, SessionSummary } from "../model/session-event.js";
import type { ExportInput, Exporter } from "./types.js";

/** Canonical field order so identical data serializes identically; attrs/payload/meta keep
 *  their own key insertion order and round-trip through JSON unchanged. */
function canonicalSession(s: SessionSummary): Record<string, unknown> {
  const out: Record<string, unknown> = { id: s.id, startedAt: s.startedAt };
  if (s.endedAt !== undefined) out["endedAt"] = s.endedAt;
  if (s.service !== undefined) out["service"] = s.service;
  out["eventCount"] = s.eventCount;
  out["status"] = s.status;
  if (s.label !== undefined) out["label"] = s.label;
  out["meta"] = s.meta;
  return out;
}

export function canonicalEvent(e: SessionEvent): Record<string, unknown> {
  const out: Record<string, unknown> = { sessionId: e.sessionId, seq: e.seq, ts: e.ts };
  if (e.durationMs !== undefined) out["durationMs"] = e.durationMs;
  out["type"] = e.type;
  out["name"] = e.name;
  out["status"] = e.status;
  out["attrs"] = e.attrs;
  if (e.payload !== undefined) out["payload"] = e.payload;
  out["provenance"] = {
    traceId: e.provenance.traceId,
    spanId: e.provenance.spanId,
    dialect: e.provenance.dialect,
    captureMode: e.provenance.captureMode,
  };
  return out;
}

export const sessionFile: Exporter = {
  name: "session-file",
  extension: "session.jsonl",
  export(input: ExportInput): string {
    const lines = [
      JSON.stringify({ format: SESSION_FILE_FORMAT, session: canonicalSession(input.session) }),
      ...input.events.map((e) => JSON.stringify(canonicalEvent(e))),
    ];
    return lines.join("\n") + "\n";
  },
};

export interface ParsedSessionFile {
  session: SessionSummary;
  events: SessionEvent[];
}

export function parseSessionFile(content: string): ParsedSessionFile {
  const lines = content.split("\n").filter((line) => line.length > 0);
  if (lines.length === 0) throw new Error("empty session file");
  const header = JSON.parse(lines[0]!) as { format?: string; session?: SessionSummary };
  if (header.format !== SESSION_FILE_FORMAT) {
    throw new Error(
      `unsupported format ${JSON.stringify(header.format)} (this build reads ${SESSION_FILE_FORMAT})`,
    );
  }
  if (header.session === undefined || typeof header.session.id !== "string") {
    throw new Error("session file header has no session object");
  }
  const events = lines.slice(1).map((line, i) => {
    const event = JSON.parse(line) as SessionEvent;
    if (typeof event.seq !== "number" || typeof event.ts !== "string") {
      throw new Error(`line ${i + 2}: not a SessionEvent`);
    }
    return event;
  });
  return { session: header.session, events };
}
