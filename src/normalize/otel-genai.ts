// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// OpenTelemetry GenAI semantic-conventions dialect: event type from gen_ai.operation.name, content
// relocated (never duplicated) from gen_ai.* attrs into the payload, with sessionist.payload_source set.

import type { AttrValue, RawLogRecord, RawSpan } from "../receiver/raw-span.js";
import { nanoToIso } from "../receiver/raw-span.js";
import type { EventPayload, SessionEventType } from "../model/session-event.js";
import type { Dialect, GroupingHints, NormalizedEvent } from "./types.js";
import {
  baseAttrsFromSpan,
  groupingFromSpan,
  parseMaybeJson,
  spanEventsToAttr,
  statusFromSpan,
} from "./shared.js";

const LLM_OPS = new Set(["chat", "text_completion", "generate_content", "embeddings", "fetch_response"]);
const BRACKET_OPS = new Set(["invoke_agent", "invoke_workflow"]);

/** Content-by-reference attributes: a URI stands in for the content. */
const REF_ATTRS = [
  "gen_ai.input.messages_ref",
  "gen_ai.output.messages_ref",
  "gen_ai.system_instructions_ref",
  "gen_ai.tool.definitions_ref",
];

function hasGenAiAttrs(attrs: Record<string, AttrValue>): boolean {
  for (const key of Object.keys(attrs)) {
    if (key.startsWith("gen_ai.")) return true;
  }
  return false;
}

interface ExtractedPayload {
  payload?: EventPayload;
  source?: string;
  parseError: boolean;
  /** Attr keys relocated into the payload (removed from stored attrs). */
  consumedAttrKeys: string[];
  /** Reference attributes present when no inline content was. Preserved in
   *  attrs; listed so the viewer can say where the content lives. */
  refs: string[];
}

function extractContent(span: RawSpan, op: unknown): ExtractedPayload {
  const out: ExtractedPayload = { parseError: false, consumedAttrKeys: [], refs: [] };
  const a = span.attributes;

  const take = (key: string): unknown => {
    const raw = a[key];
    if (raw === undefined) return undefined;
    const { value, parseError } = parseMaybeJson(raw);
    if (parseError) out.parseError = true;
    out.consumedAttrKeys.push(key);
    return value;
  };

  let input: unknown;
  let output: unknown;

  if (op === "retrieval") {
    input = take("gen_ai.retrieval.query.text");
    output = take("gen_ai.retrieval.documents");
    if (input !== undefined || output !== undefined) out.source = "gen_ai.retrieval";
  } else {
    // Message content on span attributes (inference and agent operations).
    const messages = take("gen_ai.input.messages");
    output = take("gen_ai.output.messages");
    const systemInstructions = take("gen_ai.system_instructions");
    const toolDefinitions = take("gen_ai.tool.definitions");
    if (messages !== undefined || output !== undefined || systemInstructions !== undefined || toolDefinitions !== undefined) {
      out.source = "gen_ai.input.messages";
      if (systemInstructions === undefined && toolDefinitions === undefined) {
        input = messages;
      } else {
        const shaped: Record<string, unknown> = {};
        if (systemInstructions !== undefined) shaped["system_instructions"] = systemInstructions;
        if (toolDefinitions !== undefined) shaped["tool_definitions"] = toolDefinitions;
        if (messages !== undefined) shaped["messages"] = messages;
        input = shaped;
      }
    }

    // Tool IO attrs (execute_tool, including MCP tool calls).
    if (input === undefined && output === undefined) {
      input = take("gen_ai.tool.call.arguments");
      output = take("gen_ai.tool.call.result");
      if (input !== undefined || output !== undefined) out.source = "gen_ai.tool.call";
    }

    // Content by reference: record the attribute; nothing is fetched.
    if (input === undefined && output === undefined) {
      for (const key of REF_ATTRS) if (a[key] !== undefined) out.refs.push(key);
      if (out.refs.length > 0) out.source = "reference";
    }
  }

  if (input !== undefined || output !== undefined) {
    const payload: EventPayload = {};
    if (input !== undefined) payload.input = input;
    if (output !== undefined) payload.output = output;
    out.payload = payload;
  }
  return out;
}

function buildAttrs(span: RawSpan, extracted: ExtractedPayload): Record<string, unknown> {
  const attrs = baseAttrsFromSpan(span);
  for (const key of extracted.consumedAttrKeys) delete attrs[key];
  const remaining = span.events.filter((ev) => ev.name !== "exception");
  const serialized = spanEventsToAttr(remaining);
  if (serialized !== undefined) attrs["otel.events"] = serialized;
  if (extracted.source !== undefined) attrs["sessionist.payload_source"] = extracted.source;
  if (extracted.refs.length > 0) attrs["sessionist.payload_refs"] = extracted.refs;
  if (extracted.parseError) attrs["sessionist.payload_parse_error"] = true;
  return attrs;
}

/** Exception span events become their own error events. */
function exceptionEvents(span: RawSpan, grouping: GroupingHints): NormalizedEvent[] {
  const out: NormalizedEvent[] = [];
  for (const ev of span.events) {
    if (ev.name !== "exception") continue;
    const type = ev.attributes["exception.type"];
    out.push({
      ts: ev.timeUnixNano > 0n ? nanoToIso(ev.timeUnixNano) : nanoToIso(span.endTimeUnixNano),
      type: "error",
      name: typeof type === "string" ? type : "exception",
      status: "error",
      attrs: { ...ev.attributes, "sessionist.derived": "span_event" },
      provenance: { traceId: span.traceId, spanId: span.spanId, dialect: "otel-genai", captureMode: "otlp" },
      grouping,
    });
  }
  return out;
}

export const otelGenai: Dialect = {
  name: "otel-genai",

  matches(span: RawSpan): boolean {
    return hasGenAiAttrs(span.attributes);
  },

  normalize(span: RawSpan): NormalizedEvent[] {
    const op = span.attributes["gen_ai.operation.name"];
    const grouping = groupingFromSpan(span);
    const extracted = extractContent(span, op);
    const attrs = buildAttrs(span, extracted);
    const status = statusFromSpan(span);
    const startTs = nanoToIso(span.startTimeUnixNano);
    const durationMs =
      span.endTimeUnixNano > 0n && span.startTimeUnixNano > 0n
        ? Number(span.endTimeUnixNano - span.startTimeUnixNano) / 1e6
        : undefined;
    const provenance = {
      traceId: span.traceId,
      spanId: span.spanId,
      dialect: "otel-genai",
      captureMode: "otlp" as const,
    };

    const pick = (key: string): string | undefined => {
      const v = span.attributes[key];
      return typeof v === "string" && v !== "" ? v : undefined;
    };

    let events: NormalizedEvent[];

    if (typeof op === "string" && BRACKET_OPS.has(op)) {
      // Project the span as start/end point events; the shared provenance.spanId lets the
      // player render them as one bracket.
      const name = (op === "invoke_workflow" ? pick("gen_ai.workflow.name") : pick("gen_ai.agent.name")) ?? span.name;
      const start: NormalizedEvent = {
        ts: startTs,
        type: "agent_start",
        name,
        status: "unset", // the outcome is not knowable at the start instant
        attrs: { ...attrs, "sessionist.derived": "span_boundary", "sessionist.boundary": "start" },
        provenance,
        grouping,
      };
      if (extracted.payload?.input !== undefined) start.payload = { input: extracted.payload.input };
      const end: NormalizedEvent = {
        ts: nanoToIso(span.endTimeUnixNano),
        type: "agent_end",
        name,
        status,
        attrs: { ...attrs, "sessionist.derived": "span_boundary", "sessionist.boundary": "end" },
        provenance,
        grouping,
      };
      if (durationMs !== undefined) end.durationMs = durationMs;
      if (extracted.payload?.output !== undefined) end.payload = { output: extracted.payload.output };
      events = [start, end];
    } else {
      let type: SessionEventType;
      let name: string;
      if (typeof op === "string" && LLM_OPS.has(op)) {
        type = "llm_call";
        name = pick("gen_ai.request.model") ?? pick("gen_ai.response.model") ?? span.name;
      } else if (op === "execute_tool") {
        const target = pick("gen_ai.transfer.target.name");
        if (target !== undefined || pick("gen_ai.transfer.mode") !== undefined) {
          // gen_ai.transfer.*: a tool call that hands control to another agent.
          type = "handoff";
          name = target ?? pick("gen_ai.tool.name") ?? span.name;
        } else {
          type = "tool_call";
          name = pick("gen_ai.tool.name") ?? span.name;
        }
      } else if (op === "retrieval") {
        type = "retrieval";
        name = pick("gen_ai.data_source.id") ?? span.name;
      } else {
        // Other operation names (plan, create_agent, memory ops, unknown) stay a plain span.
        type = "span";
        name = span.name;
      }
      const event: NormalizedEvent = { ts: startTs, type, name, status, attrs, provenance, grouping };
      if (durationMs !== undefined) event.durationMs = durationMs;
      if (extracted.payload !== undefined) event.payload = extracted.payload;
      events = [event];
    }

    return [...events, ...exceptionEvents(span, grouping)];
  },

  matchesLog(log: RawLogRecord): boolean {
    const eventName = log.eventName ?? (typeof log.attributes["event.name"] === "string" ? (log.attributes["event.name"] as string) : undefined);
    return (eventName !== undefined && eventName.startsWith("gen_ai.")) || hasGenAiAttrs(log.attributes);
  },

  /** gen_ai log records: inference.operation.details content relocates into the payload,
   *  operation.exception becomes an error event, anything else is a plain event with body as payload. */
  normalizeLog(log: RawLogRecord): NormalizedEvent[] {
    const eventName =
      log.eventName ?? (typeof log.attributes["event.name"] === "string" ? (log.attributes["event.name"] as string) : "log");
    const tsNano = log.timeUnixNano && log.timeUnixNano > 0n ? log.timeUnixNano : log.observedTimeUnixNano;
    if (tsNano === undefined || tsNano === 0n) return []; // a record with no time cannot be placed on a timeline

    const attrs: Record<string, unknown> = { ...log.attributes };
    for (const [k, v] of Object.entries(log.resource.attributes)) attrs[`resource.${k}`] = v;
    if (log.scope?.name !== undefined) attrs["otel.scope.name"] = log.scope.name;
    if (log.severityText !== undefined) attrs["otel.severity_text"] = log.severityText;
    if (log.severityNumber !== undefined) attrs["otel.severity_number"] = log.severityNumber;
    attrs["sessionist.signal"] = "logs";

    let type: SessionEventType = "span";
    let name = eventName;
    let status: NormalizedEvent["status"] = "unset";
    let payload: EventPayload | undefined;
    if (eventName === "gen_ai.client.inference.operation.details") {
      const p: EventPayload = {};
      const takeLog = (key: string): unknown => {
        const raw = attrs[key];
        if (raw === undefined) return undefined;
        delete attrs[key];
        return parseMaybeJson(raw as AttrValue).value;
      };
      const messages = takeLog("gen_ai.input.messages");
      const output = takeLog("gen_ai.output.messages");
      const systemInstructions = takeLog("gen_ai.system_instructions");
      const toolDefinitions = takeLog("gen_ai.tool.definitions");
      if (systemInstructions === undefined && toolDefinitions === undefined) {
        if (messages !== undefined) p.input = messages;
      } else {
        const shaped: Record<string, unknown> = {};
        if (systemInstructions !== undefined) shaped["system_instructions"] = systemInstructions;
        if (toolDefinitions !== undefined) shaped["tool_definitions"] = toolDefinitions;
        if (messages !== undefined) shaped["messages"] = messages;
        p.input = shaped;
      }
      if (output !== undefined) p.output = output;
      if (p.input !== undefined || p.output !== undefined) {
        payload = p;
        attrs["sessionist.payload_source"] = "log_attributes";
      }
    } else if (eventName === "gen_ai.client.operation.exception") {
      type = "error";
      status = "error";
      const exceptionType = log.attributes["exception.type"];
      if (typeof exceptionType === "string" && exceptionType !== "") name = exceptionType;
      attrs["sessionist.derived"] = "log_event";
    } else if (log.body !== undefined) {
      payload = { input: log.body };
    }

    const grouping: GroupingHints = { startNano: tsNano };
    const svc = log.resource.attributes["service.name"];
    if (typeof svc === "string" && svc !== "") grouping.serviceName = svc;
    const conv = log.attributes["gen_ai.conversation.id"];
    if (typeof conv === "string" && conv !== "") grouping.conversationId = conv;
    const sess = log.attributes["session.id"];
    if (typeof sess === "string" && sess !== "") grouping.explicitSessionId = sess;

    const event: NormalizedEvent = {
      ts: nanoToIso(tsNano),
      type,
      name,
      status,
      attrs,
      provenance: {
        traceId: log.traceId ?? "",
        spanId: log.spanId ?? "",
        dialect: "otel-genai",
        captureMode: "otlp",
      },
      grouping,
    };
    if (payload !== undefined) event.payload = payload;
    return [event];
  },
};
