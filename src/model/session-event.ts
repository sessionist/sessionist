// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// The core data model (public contract): additive evolution only; renames/removals require a
// session file format version bump.

export type SessionEventType =
  | "agent_start"
  | "agent_end"
  | "llm_call"
  | "tool_call"
  | "retrieval"
  | "handoff"
  | "error"
  | "user_message"
  | "assistant_message"
  | "span"; // unrecognized passthrough

export type EventStatus = "ok" | "error" | "unset";
export type SessionStatus = "running" | "ok" | "error";
export type CaptureMode = "otlp" | "proxy";

export interface EventPayload {
  input?: unknown; // exact assembled prompt / tool args
  output?: unknown; // completion / tool result
}

export interface Provenance {
  traceId: string;
  spanId: string;
  dialect: string;
  captureMode: CaptureMode;
}

export interface SessionEvent {
  sessionId: string;
  seq: number; // dense ordering within session (commit order)
  ts: string; // ISO 8601 UTC, 9-digit fractional seconds (lossless nanos)
  durationMs?: number;
  type: SessionEventType;
  name: string; // e.g. tool name, model name
  status: EventStatus;
  attrs: Record<string, unknown>; // flat, namespaced (gen_ai.*, sessionist.*)
  payload?: EventPayload; // large bodies, lazily loaded
  provenance: Provenance;
}

export interface SessionSummary {
  id: string;
  startedAt: string;
  endedAt?: string;
  service?: string;
  eventCount: number;
  status: SessionStatus;
  label?: string;
  meta: Record<string, unknown>;
}
