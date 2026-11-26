// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// Embedded mode: serves the api.ts surface from the session blob inlined in a .session.html export.

import type { EventPayload, SessionSummary, TimelineEvent } from "./api";

declare global {
  interface Window {
    __SESSIONIST_EMBEDDED_JSONL__?: Promise<string>;
  }
}

export function isEmbedded(): boolean {
  return typeof window !== "undefined" && window.__SESSIONIST_EMBEDDED_JSONL__ !== undefined;
}

interface EmbeddedStore {
  session: SessionSummary;
  /** Chronological (ts, seq) — the same order the Query API serves. */
  timeline: TimelineEvent[];
  payloads: Map<number, EventPayload>;
  searchable: Map<number, string>;
}

let storePromise: Promise<EmbeddedStore> | null = null;

function load(): Promise<EmbeddedStore> {
  if (storePromise === null) {
    storePromise = window.__SESSIONIST_EMBEDDED_JSONL__!.then(parseSessionJsonl);
  }
  return storePromise;
}

function parseSessionJsonl(jsonl: string): EmbeddedStore {
  const lines = jsonl.split("\n").filter((line) => line.length > 0);
  const header = JSON.parse(lines[0]!) as { format: string; session: SessionSummary };
  const timeline: TimelineEvent[] = [];
  const payloads = new Map<number, EventPayload>();
  const searchable = new Map<number, string>();
  for (const line of lines.slice(1)) {
    const raw = JSON.parse(line) as TimelineEvent & { payload?: EventPayload };
    const { payload, ...rest } = raw;
    const event: TimelineEvent = { ...rest, hasPayload: payload !== undefined };
    if (payload !== undefined) {
      const serialized = JSON.stringify(payload);
      event.payloadBytes = serialized.length;
      payloads.set(event.seq, payload);
      searchable.set(event.seq, serialized.toLowerCase());
    }
    timeline.push(event);
  }
  timeline.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : a.seq - b.seq));
  return { session: header.session, timeline, payloads, searchable };
}

export const embeddedApi = {
  async listSessions(): Promise<{ sessions: SessionSummary[] }> {
    const store = await load();
    return { sessions: [store.session] };
  },

  async getSession(id: string): Promise<SessionSummary> {
    const store = await load();
    if (id !== store.session.id) throw new Error(`this file holds session ${store.session.id}`);
    return store.session;
  },

  async getTimeline(id: string): Promise<TimelineEvent[]> {
    const store = await load();
    if (id !== store.session.id) return [];
    return store.timeline;
  },

  async getPayload(_id: string, seq: number): Promise<EventPayload> {
    const store = await load();
    const payload = store.payloads.get(seq);
    if (payload === undefined) throw new Error("no payload for this event");
    return payload;
  },

  async search(q: string): Promise<{ sessions: (SessionSummary & { matchSeqs: number[] })[] }> {
    const store = await load();
    const needle = q.toLowerCase();
    const matchSeqs = [...store.searchable.entries()]
      .filter(([, text]) => text.includes(needle))
      .map(([seq]) => seq)
      .sort((a, b) => a - b);
    return { sessions: matchSeqs.length > 0 ? [{ ...store.session, matchSeqs }] : [] };
  },

  /** The file is a snapshot; there is nothing live to subscribe to. */
  subscribeActivity(): () => void {
    return () => {};
  },

  async initialSessionId(): Promise<string> {
    return (await load()).session.id;
  },
};
