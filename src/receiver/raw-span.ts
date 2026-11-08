// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// RawSpan / RawLogRecord: the shared output of both OTLP decoders and the input to every dialect.
// Absent wire fields stay absent (never defaulted); unsafe int64 -> decimal string; bytes -> { "@bytes": base64 }.

/** Attribute value after OTLP AnyValue collapse. */
export type AttrValue =
  | string
  | number
  | boolean
  | null
  | AttrValue[]
  | { [key: string]: AttrValue };

export type Attrs = Record<string, AttrValue>;

export interface RawResource {
  attributes: Attrs;
  droppedAttributesCount?: number;
}

export interface RawScope {
  name?: string;
  version?: string;
  attributes?: Attrs;
}

export interface RawSpanEvent {
  timeUnixNano: bigint;
  name: string;
  attributes: Attrs;
  droppedAttributesCount?: number;
}

export interface RawSpanLink {
  traceId: string; // 32-char lowercase hex
  spanId: string; // 16-char lowercase hex
  traceState?: string;
  attributes: Attrs;
}

export interface RawSpan {
  traceId: string; // 32-char lowercase hex
  spanId: string; // 16-char lowercase hex
  parentSpanId?: string; // absent when zero/empty — never ""
  name: string;
  kind: number; // SpanKind enum value, preserved verbatim
  startTimeUnixNano: bigint;
  endTimeUnixNano: bigint;
  attributes: Attrs;
  events: RawSpanEvent[];
  links: RawSpanLink[];
  status?: { code: number; message?: string }; // absent if unset on the wire
  traceState?: string;
  droppedAttributesCount?: number;
  droppedEventsCount?: number;
  droppedLinksCount?: number;
  resource: RawResource; // shared reference per ResourceSpans batch
  scope?: RawScope; // shared reference per ScopeSpans batch
}

export interface RawLogRecord {
  timeUnixNano?: bigint;
  observedTimeUnixNano?: bigint;
  severityText?: string;
  severityNumber?: number;
  eventName?: string; // LogRecord.event_name (OTLP >= 1.4)
  body?: AttrValue;
  attributes: Attrs;
  traceId?: string;
  spanId?: string;
  resource: RawResource;
  scope?: RawScope;
}

/** Lossless nanos → ISO 8601 UTC with 9 fractional digits (fixed width, so
 *  lexicographic order equals chronological order). */
export function nanoToIso(nano: bigint): string {
  const ms = nano / 1_000_000n;
  const withinSecond = nano % 1_000_000_000n;
  const base = new Date(Number(ms)).toISOString(); // yyyy-mm-ddThh:mm:ss.mmmZ
  const frac = withinSecond.toString().padStart(9, "0");
  return base.slice(0, 19) + "." + frac + "Z";
}

/** ISO 8601 → nanos. Inverse of nanoToIso for full-precision timestamps. */
export function isoToNano(iso: string): bigint {
  const dotIdx = iso.indexOf(".");
  const secondsPart = dotIdx === -1 ? iso.replace("Z", "") : iso.slice(0, dotIdx);
  const fracPart = dotIdx === -1 ? "" : iso.slice(dotIdx + 1).replace("Z", "");
  const epochMs = Date.parse(secondsPart + "Z");
  const nanos = BigInt(fracPart.padEnd(9, "0").slice(0, 9));
  return BigInt(epochMs) * 1_000_000n + nanos;
}

export function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

/** int64 wire value (number | Long-like | string) → number if safe, else decimal string. */
export function int64ToJs(v: number | string | { toString(): string }): number | string {
  const s = typeof v === "string" ? v : v.toString();
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : s;
}

export function int64ToBigInt(v: number | string | { toString(): string }): bigint {
  return typeof v === "number" ? BigInt(Math.trunc(v)) : BigInt(v.toString());
}
