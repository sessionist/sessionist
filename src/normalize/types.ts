// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

import type { EventPayload, EventStatus, Provenance, SessionEventType } from "../model/session-event.js";
import type { RawLogRecord, RawSpan } from "../receiver/raw-span.js";

/** A SessionEvent before the assembler assigns sessionId + seq. The grouping
 *  block carries assembler hints only; it is never stored. */
export interface NormalizedEvent {
  ts: string;
  durationMs?: number;
  type: SessionEventType;
  name: string;
  status: EventStatus;
  attrs: Record<string, unknown>;
  payload?: EventPayload;
  provenance: Provenance;
  grouping: GroupingHints;
}

export interface GroupingHints {
  conversationId?: string; // gen_ai.conversation.id — highest priority
  explicitSessionId?: string; // session.id attribute — second priority
  serviceName?: string; // resource service.name — heuristic fallback
  startNano?: bigint;
  endNano?: bigint;
}

/** Dialect registry entry: one file implementing this interface plus one line in normalize/index.ts. */
export interface Dialect {
  name: string;
  /** Cheap sniff; the first matching dialect in registration order wins. */
  matches(span: RawSpan): boolean;
  /** Pure function, no I/O. May emit multiple events per span. */
  normalize(span: RawSpan): NormalizedEvent[];
  /** Optional log-signal support (e.g. gen_ai content events on /v1/logs). */
  matchesLog?(log: RawLogRecord): boolean;
  normalizeLog?(log: RawLogRecord): NormalizedEvent[];
}
