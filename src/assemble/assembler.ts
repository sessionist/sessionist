// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// Incremental session assembly: events group by gen_ai.conversation.id, then session.id, then
// same-service idle-gap window, with trace lineage binding later spans of a trace to its session.

import { randomUUID } from "node:crypto";
import type { NormalizedEvent } from "../normalize/types.js";
import type { SessionStore } from "../store/store.js";

export interface AssemblerOptions {
  gapMs?: number;
  now?: () => number; // wall clock, injectable for tests
  newSessionId?: () => string; // injectable for deterministic fixtures tests
  onActivity?: (sessionIds: string[]) => void; // live-mode hook (SSE)
}

interface LiveSession {
  lastActivityMs: number;
  finalized: boolean;
  groupKey?: string;
}

const DEFAULT_GAP_MS = 10 * 60 * 1000;

export class Assembler {
  private readonly gapMs: number;
  private readonly now: () => number;
  private readonly newSessionId: () => string;
  private readonly onActivity: ((sessionIds: string[]) => void) | undefined;

  private readonly openByKey = new Map<string, string>();
  private readonly traceBind = new Map<string, { sessionId: string; boundAtMs: number }>();
  private readonly sessions = new Map<string, LiveSession>();

  constructor(
    private readonly store: SessionStore,
    opts: AssemblerOptions = {},
  ) {
    this.gapMs = opts.gapMs ?? DEFAULT_GAP_MS;
    this.now = opts.now ?? Date.now;
    this.newSessionId = opts.newSessionId ?? randomUUID;
    this.onActivity = opts.onActivity;
  }

  /** Re-adopt or finalize sessions left 'running' by a previous process. */
  recover(): void {
    const nowMs = this.now();
    for (const s of this.store.recoverOpenSessions()) {
      const lastMs = s.lastEventTs !== null ? Date.parse(s.lastEventTs.slice(0, 23) + "Z") : NaN;
      if (Number.isNaN(lastMs) || nowMs - lastMs > this.gapMs) {
        this.store.finalizeSession(s.id, "recovered_on_startup");
        continue;
      }
      const ns = s.meta["sessionist"] as Record<string, unknown> | undefined;
      const groupKey = typeof ns?.["group_key"] === "string" ? (ns["group_key"] as string) : undefined;
      const live: LiveSession = { lastActivityMs: nowMs, finalized: false };
      if (groupKey !== undefined) {
        live.groupKey = groupKey;
        this.openByKey.set(groupKey, s.id);
      }
      this.sessions.set(s.id, live);
      for (const traceId of s.traceIds) {
        this.traceBind.set(traceId, { sessionId: s.id, boundAtMs: nowMs });
      }
    }
  }

  /** Route a batch of normalized events into sessions and append them. */
  ingest(events: NormalizedEvent[]): void {
    if (events.length === 0) return;
    const nowMs = this.now();
    const staged = new Map<string, NormalizedEvent[]>();

    for (const event of events) {
      const { sessionId, rule } = this.resolveSession(event, nowMs);
      event.attrs["sessionist.group_rule"] = rule;
      const live = this.sessions.get(sessionId);
      if (live?.finalized !== false) {
        // Session already closed (idle gap) or predates this process: label the append, never resequence.
        event.attrs["sessionist.late_arrival"] = true;
      } else {
        live.lastActivityMs = nowMs;
      }
      let bucket = staged.get(sessionId);
      if (bucket === undefined) staged.set(sessionId, (bucket = []));
      bucket.push(event);
    }

    for (const [sessionId, bucket] of staged) {
      this.store.appendEvents(sessionId, bucket);
    }
    this.onActivity?.([...staged.keys()]);
  }

  /** Close idle sessions; purge stale trace bindings. Call periodically. */
  sweep(): void {
    const nowMs = this.now();
    for (const [sessionId, live] of this.sessions) {
      if (!live.finalized && nowMs - live.lastActivityMs > this.gapMs) {
        this.store.finalizeSession(sessionId, "idle_gap");
        live.finalized = true;
        if (live.groupKey !== undefined && this.openByKey.get(live.groupKey) === sessionId) {
          this.openByKey.delete(live.groupKey);
        }
        this.onActivity?.([sessionId]);
      }
    }
    // Trace bindings outlive their session by one extra gap so late spans of a
    // known trace still reach the (closed) session they belong to.
    for (const [traceId, bind] of this.traceBind) {
      const live = this.sessions.get(bind.sessionId);
      const idleMs = nowMs - (live && !live.finalized ? live.lastActivityMs : bind.boundAtMs);
      if (idleMs > 2 * this.gapMs) {
        this.traceBind.delete(traceId);
        if (live?.finalized !== false) this.sessions.delete(bind.sessionId);
      }
    }
  }

  private resolveSession(
    event: NormalizedEvent,
    nowMs: number,
  ): { sessionId: string; rule: string } {
    const conv = event.grouping.conversationId;
    const sess = event.grouping.explicitSessionId;
    const key = conv !== undefined ? `conv:${conv}` : sess !== undefined ? `sess:${sess}` : undefined;
    const keyRule = conv !== undefined ? "conversation_id" : "session_id";
    const traceId = event.provenance.traceId;

    // Explicit grouping key on an open session.
    if (key !== undefined) {
      const bound = this.openByKey.get(key);
      if (bound !== undefined) {
        this.bindTrace(traceId, bound, nowMs);
        return { sessionId: bound, rule: keyRule };
      }
    }

    // Trace lineage.
    if (traceId !== "") {
      const bind = this.traceBind.get(traceId);
      if (bind !== undefined) {
        bind.boundAtMs = nowMs;
        // A key seen mid-trace adopts the session so later keyed events join it.
        if (key !== undefined && !this.openByKey.has(key)) this.openByKey.set(key, bind.sessionId);
        return { sessionId: bind.sessionId, rule: key !== undefined ? keyRule : "trace_lineage" };
      }
    }

    // Explicit key with no open session -> new session under that key.
    if (key !== undefined) {
      const sessionId = this.createSession(event, key, keyRule);
      this.bindTrace(traceId, sessionId, nowMs);
      return { sessionId, rule: keyRule };
    }

    // Same-service time window.
    const svcKey = `svc:${event.grouping.serviceName ?? ""}`;
    const open = this.openByKey.get(svcKey);
    if (open !== undefined && this.sessions.get(open)?.finalized === false) {
      this.bindTrace(traceId, open, nowMs);
      return { sessionId: open, rule: "time_window" };
    }

    const sessionId = this.createSession(event, svcKey, "time_window");
    this.bindTrace(traceId, sessionId, nowMs);
    return { sessionId, rule: "new_session" };
  }

  private bindTrace(traceId: string, sessionId: string, nowMs: number): void {
    if (traceId === "") return;
    if (!this.traceBind.has(traceId)) {
      this.traceBind.set(traceId, { sessionId, boundAtMs: nowMs });
    }
  }

  private createSession(event: NormalizedEvent, groupKey: string, rule: string): string {
    const id = this.newSessionId();
    const meta: Record<string, unknown> = {
      sessionist: { grouping_rule: rule, group_key: groupKey, gap_ms: this.gapMs },
    };
    const service = event.grouping.serviceName;
    this.store.createSession(
      service !== undefined
        ? { id, startedAt: event.ts, service, meta }
        : { id, startedAt: event.ts, meta },
    );
    this.openByKey.set(groupKey, id);
    this.sessions.set(id, { lastActivityMs: this.now(), finalized: false, groupKey });
    return id;
  }
}
