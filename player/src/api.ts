// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// Query API client; in a .session.html export the same surface is served from the embedded blob (see embedded.ts).

import { embeddedApi, isEmbedded } from "./embedded";

export interface SessionSummary {
  id: string;
  startedAt: string;
  endedAt?: string;
  service?: string;
  eventCount: number;
  status: "running" | "ok" | "error";
  label?: string;
  meta: Record<string, unknown>;
}

export interface TimelineEvent {
  sessionId: string;
  seq: number;
  ts: string;
  durationMs?: number;
  type: string;
  name: string;
  status: "ok" | "error" | "unset";
  attrs: Record<string, unknown>;
  provenance: { traceId: string; spanId: string; dialect: string; captureMode: "otlp" | "proxy" };
  hasPayload: boolean;
  payloadBytes?: number;
  payloadRef?: string;
}

export interface EventPayload {
  input?: unknown;
  output?: unknown;
}

/** The odometer: how much coding agents have read over MCP. Not available in an export. */
export interface ReadsSummary {
  calls: number;
  bytes: number;
  sessions: number;
  firstTs?: string;
  lastTs?: string;
  byClient: { client: string; calls: number; bytes: number; lastTs: string }[];
  byTool: { tool: string; calls: number; bytes: number }[];
}

export interface SessionReads {
  calls: number;
  bytes: number;
  lastTs?: string;
}

const NO_READS: ReadsSummary = { calls: 0, bytes: 0, sessions: 0, byClient: [], byTool: [] };

export function getReadsSummary(): Promise<ReadsSummary> {
  if (isEmbedded()) return Promise.resolve(NO_READS);
  return getJson("/api/reads");
}

export function getSessionReads(id: string): Promise<SessionReads> {
  if (isEmbedded()) return Promise.resolve({ calls: 0, bytes: 0 });
  return getJson(`/api/sessions/${encodeURIComponent(id)}/reads`);
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return (await res.json()) as T;
}

export function listSessions(filter: { status?: string } = {}): Promise<{ sessions: SessionSummary[] }> {
  if (isEmbedded()) return embeddedApi.listSessions();
  const params = new URLSearchParams({ limit: "100" });
  if (filter.status !== undefined) params.set("status", filter.status);
  return getJson(`/api/sessions?${params}`);
}

export function getSession(id: string): Promise<SessionSummary> {
  if (isEmbedded()) return embeddedApi.getSession(id);
  return getJson(`/api/sessions/${encodeURIComponent(id)}`);
}

/** Fetches the full chronological timeline, paging until done (payloads are
 *  never inlined here, so even long sessions stay light). */
export async function getTimeline(id: string): Promise<TimelineEvent[]> {
  if (isEmbedded()) return embeddedApi.getTimeline(id);
  const events: TimelineEvent[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 50; page++) {
    const params = new URLSearchParams({ order: "ts", limit: "1000" });
    if (cursor !== undefined) params.set("cursor", cursor);
    const body = await getJson<{ events: TimelineEvent[]; nextCursor?: string }>(
      `/api/sessions/${encodeURIComponent(id)}/events?${params}`,
    );
    events.push(...body.events);
    if (body.nextCursor === undefined) break;
    cursor = body.nextCursor;
  }
  return events;
}

export function getPayload(sessionId: string, seq: number): Promise<EventPayload> {
  if (isEmbedded()) return embeddedApi.getPayload(sessionId, seq);
  return getJson(`/api/sessions/${encodeURIComponent(sessionId)}/events/${seq}/payload`);
}

export function search(q: string): Promise<{ sessions: (SessionSummary & { matchSeqs: number[] })[] }> {
  if (isEmbedded()) return embeddedApi.search(q);
  return getJson(`/api/search?q=${encodeURIComponent(q)}`);
}

/** Live activity nudges. Returns an unsubscribe function. Falls back to
 *  polling if EventSource errors (e.g. proxy without SSE support). */
export function subscribeActivity(onActivity: (sessionIds: string[]) => void): () => void {
  if (isEmbedded()) return embeddedApi.subscribeActivity();
  let source: EventSource | null = null;
  let pollTimer: number | null = null;
  try {
    source = new EventSource("/api/stream");
    source.addEventListener("activity", (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data as string) as { sessionIds: string[] };
        onActivity(data.sessionIds);
      } catch {
        onActivity([]);
      }
    });
    source.onerror = () => {
      if (pollTimer === null) {
        pollTimer = window.setInterval(() => onActivity([]), 4000);
      }
    };
    source.onopen = () => {
      if (pollTimer !== null) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };
  } catch {
    pollTimer = window.setInterval(() => onActivity([]), 4000);
  }
  return () => {
    source?.close();
    if (pollTimer !== null) clearInterval(pollTimer);
  };
}
