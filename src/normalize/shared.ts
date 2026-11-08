// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// Helpers shared by dialect implementations.

import type { AttrValue, RawSpan, RawSpanEvent } from "../receiver/raw-span.js";
import { nanoToIso } from "../receiver/raw-span.js";
import type { EventStatus } from "../model/session-event.js";
import type { GroupingHints } from "./types.js";

/** Span attrs verbatim + resource attrs under "resource." + scope/kind under
 *  "otel.*". Source namespaces are never mixed with derived sessionist.* keys. */
export function baseAttrsFromSpan(span: RawSpan): Record<string, unknown> {
  const attrs: Record<string, unknown> = { ...span.attributes };
  for (const [k, v] of Object.entries(span.resource.attributes)) {
    attrs[`resource.${k}`] = v;
  }
  attrs["otel.span.kind"] = span.kind;
  if (span.traceState !== undefined) attrs["otel.trace_state"] = span.traceState;
  if (span.scope?.name !== undefined) attrs["otel.scope.name"] = span.scope.name;
  if (span.scope?.version !== undefined) attrs["otel.scope.version"] = span.scope.version;
  if (span.parentSpanId !== undefined) attrs["otel.parent_span_id"] = span.parentSpanId;
  if (span.status?.message !== undefined) attrs["otel.status_message"] = span.status.message;
  if (span.droppedAttributesCount) attrs["otel.dropped_attributes_count"] = span.droppedAttributesCount;
  if (span.droppedEventsCount) attrs["otel.dropped_events_count"] = span.droppedEventsCount;
  if (span.droppedLinksCount) attrs["otel.dropped_links_count"] = span.droppedLinksCount;
  if (span.links.length > 0) {
    attrs["otel.links"] = span.links.map((l) => ({
      trace_id: l.traceId,
      span_id: l.spanId,
      ...(Object.keys(l.attributes).length > 0 ? { attributes: l.attributes } : {}),
    }));
  }
  return attrs;
}

/** Span events serialized for attrs preservation. Returns undefined if none. */
export function spanEventsToAttr(events: RawSpanEvent[]): unknown[] | undefined {
  if (events.length === 0) return undefined;
  return events.map((e) => ({
    name: e.name,
    ts: e.timeUnixNano > 0n ? nanoToIso(e.timeUnixNano) : undefined,
    attributes: e.attributes,
  }));
}

export function statusFromSpan(span: RawSpan): EventStatus {
  if (span.status === undefined) return "unset";
  if (span.status.code === 2) return "error";
  if (span.status.code === 1) return "ok";
  return "unset";
}

export function groupingFromSpan(span: RawSpan): GroupingHints {
  const hints: GroupingHints = {};
  const conv = span.attributes["gen_ai.conversation.id"];
  if (typeof conv === "string" && conv !== "") hints.conversationId = conv;
  const sess = span.attributes["session.id"];
  if (typeof sess === "string" && sess !== "") hints.explicitSessionId = sess;
  const svc = span.resource.attributes["service.name"];
  if (typeof svc === "string" && svc !== "") hints.serviceName = svc;
  if (span.startTimeUnixNano > 0n) hints.startNano = span.startTimeUnixNano;
  if (span.endTimeUnixNano > 0n) hints.endNano = span.endTimeUnixNano;
  return hints;
}

/** Attempt to JSON-parse a string attr value; non-strings pass through. */
export function parseMaybeJson(v: AttrValue): { value: unknown; parseError: boolean } {
  if (typeof v !== "string") return { value: v, parseError: false };
  const trimmed = v.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return { value: v, parseError: false };
  try {
    return { value: JSON.parse(trimmed), parseError: false };
  } catch {
    return { value: v, parseError: true };
  }
}
