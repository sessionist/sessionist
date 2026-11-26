// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// Hand-written OTLP/JSON decoder: OTLP/JSON deviates from the generic proto3 JSON mapping (hex ids,
// decimal-string int64s, numeric or named enums), so a generated decoder would be wrong.

import type {
  AttrValue,
  Attrs,
  RawLogRecord,
  RawResource,
  RawScope,
  RawSpan,
  RawSpanEvent,
  RawSpanLink,
} from "./raw-span.js";
import { int64ToBigInt, int64ToJs } from "./raw-span.js";

type Json = Record<string, unknown>;

function asArray(v: unknown): Json[] {
  return Array.isArray(v) ? (v as Json[]) : [];
}

function anyValueToJs(v: unknown): AttrValue {
  if (v === null || v === undefined || typeof v !== "object") return null;
  const o = v as Json;
  if (typeof o["stringValue"] === "string") return o["stringValue"];
  if (typeof o["boolValue"] === "boolean") return o["boolValue"];
  if (o["intValue"] !== undefined) return int64ToJs(o["intValue"] as number | string);
  if (o["doubleValue"] !== undefined) return Number(o["doubleValue"]);
  if (o["bytesValue"] !== undefined) return { "@bytes": String(o["bytesValue"]) };
  if (o["arrayValue"] !== undefined) {
    return asArray((o["arrayValue"] as Json)["values"]).map(anyValueToJs);
  }
  if (o["kvlistValue"] !== undefined) {
    const out: { [key: string]: AttrValue } = {};
    for (const kv of asArray((o["kvlistValue"] as Json)["values"])) {
      if (typeof kv["key"] === "string") out[kv["key"]] = anyValueToJs(kv["value"]);
    }
    return out;
  }
  return null;
}

function attrsToJs(list: unknown): Attrs {
  const out: Attrs = {};
  for (const kv of asArray(list)) {
    if (typeof kv["key"] === "string") out[kv["key"]] = anyValueToJs(kv["value"]);
  }
  return out;
}

function enumToNumber(v: unknown, names: Record<string, number>): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isInteger(n)) return n;
    return names[v] ?? 0;
  }
  return 0;
}

const STATUS_NAMES: Record<string, number> = {
  STATUS_CODE_UNSET: 0,
  STATUS_CODE_OK: 1,
  STATUS_CODE_ERROR: 2,
};

const KIND_NAMES: Record<string, number> = {
  SPAN_KIND_UNSPECIFIED: 0,
  SPAN_KIND_INTERNAL: 1,
  SPAN_KIND_SERVER: 2,
  SPAN_KIND_CLIENT: 3,
  SPAN_KIND_PRODUCER: 4,
  SPAN_KIND_CONSUMER: 5,
};

function nanos(v: unknown): bigint {
  if (v === undefined || v === null) return 0n;
  return int64ToBigInt(v as number | string);
}

function hexId(v: unknown): string {
  return typeof v === "string" ? v.toLowerCase() : "";
}

function decodeResource(o: unknown): RawResource {
  const r = (o ?? {}) as Json;
  const resource: RawResource = { attributes: attrsToJs(r["attributes"]) };
  if (typeof r["droppedAttributesCount"] === "number" && r["droppedAttributesCount"] > 0) {
    resource.droppedAttributesCount = r["droppedAttributesCount"];
  }
  return resource;
}

function decodeScope(o: unknown): RawScope | undefined {
  if (o === undefined || o === null) return undefined;
  const s = o as Json;
  const scope: RawScope = {};
  if (typeof s["name"] === "string" && s["name"] !== "") scope.name = s["name"];
  if (typeof s["version"] === "string" && s["version"] !== "") scope.version = s["version"];
  const attrs = attrsToJs(s["attributes"]);
  if (Object.keys(attrs).length > 0) scope.attributes = attrs;
  return Object.keys(scope).length > 0 ? scope : undefined;
}

export function decodeTracesJson(body: string): RawSpan[] {
  const root = JSON.parse(body) as Json;
  const spans: RawSpan[] = [];
  for (const rs of asArray(root["resourceSpans"])) {
    const resource = decodeResource(rs["resource"]);
    for (const ss of asArray(rs["scopeSpans"])) {
      const scope = decodeScope(ss["scope"]);
      for (const s of asArray(ss["spans"])) {
        const span: RawSpan = {
          traceId: hexId(s["traceId"]),
          spanId: hexId(s["spanId"]),
          name: typeof s["name"] === "string" ? s["name"] : "",
          kind: enumToNumber(s["kind"], KIND_NAMES),
          startTimeUnixNano: nanos(s["startTimeUnixNano"]),
          endTimeUnixNano: nanos(s["endTimeUnixNano"]),
          attributes: attrsToJs(s["attributes"]),
          events: asArray(s["events"]).map((e): RawSpanEvent => {
            const ev: RawSpanEvent = {
              timeUnixNano: nanos(e["timeUnixNano"]),
              name: typeof e["name"] === "string" ? e["name"] : "",
              attributes: attrsToJs(e["attributes"]),
            };
            if (typeof e["droppedAttributesCount"] === "number" && e["droppedAttributesCount"] > 0) {
              ev.droppedAttributesCount = e["droppedAttributesCount"];
            }
            return ev;
          }),
          links: asArray(s["links"]).map((l): RawSpanLink => {
            const link: RawSpanLink = {
              traceId: hexId(l["traceId"]),
              spanId: hexId(l["spanId"]),
              attributes: attrsToJs(l["attributes"]),
            };
            if (typeof l["traceState"] === "string" && l["traceState"] !== "") {
              link.traceState = l["traceState"];
            }
            return link;
          }),
          resource,
        };
        const parent = hexId(s["parentSpanId"]);
        if (parent !== "" && !/^0+$/.test(parent)) span.parentSpanId = parent;
        if (scope !== undefined) span.scope = scope;
        if (typeof s["traceState"] === "string" && s["traceState"] !== "") {
          span.traceState = s["traceState"];
        }
        const st = s["status"];
        if (st !== undefined && st !== null && typeof st === "object") {
          const code = enumToNumber((st as Json)["code"], STATUS_NAMES);
          const message = (st as Json)["message"];
          if (code !== 0 || typeof message === "string") {
            span.status = { code };
            if (typeof message === "string" && message !== "") span.status.message = message;
          }
        }
        for (const key of ["droppedAttributesCount", "droppedEventsCount", "droppedLinksCount"] as const) {
          const v = s[key];
          if (typeof v === "number" && v > 0) span[key] = v;
        }
        spans.push(span);
      }
    }
  }
  return spans;
}

export function decodeLogsJson(body: string): RawLogRecord[] {
  const root = JSON.parse(body) as Json;
  const records: RawLogRecord[] = [];
  for (const rl of asArray(root["resourceLogs"])) {
    const resource = decodeResource(rl["resource"]);
    for (const sl of asArray(rl["scopeLogs"])) {
      const scope = decodeScope(sl["scope"]);
      for (const r of asArray(sl["logRecords"])) {
        const record: RawLogRecord = {
          attributes: attrsToJs(r["attributes"]),
          resource,
        };
        const t = nanos(r["timeUnixNano"]);
        if (t > 0n) record.timeUnixNano = t;
        const ot = nanos(r["observedTimeUnixNano"]);
        if (ot > 0n) record.observedTimeUnixNano = ot;
        if (typeof r["severityText"] === "string" && r["severityText"] !== "") {
          record.severityText = r["severityText"];
        }
        if (r["severityNumber"] !== undefined) {
          record.severityNumber = enumToNumber(r["severityNumber"], {});
        }
        if (typeof r["eventName"] === "string" && r["eventName"] !== "") {
          record.eventName = r["eventName"];
        }
        if (r["body"] !== undefined && r["body"] !== null) record.body = anyValueToJs(r["body"]);
        const traceId = hexId(r["traceId"]);
        if (traceId !== "" && !/^0+$/.test(traceId)) record.traceId = traceId;
        const spanId = hexId(r["spanId"]);
        if (spanId !== "" && !/^0+$/.test(spanId)) record.spanId = spanId;
        if (scope !== undefined) record.scope = scope;
        records.push(record);
      }
    }
  }
  return records;
}
