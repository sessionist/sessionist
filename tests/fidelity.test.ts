// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// Checks over every spec scenario that the normalizer never drops a span attribute (except by
// relocating a content attribute into a payload) and never invents one.

import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { handleOtlpBody } from "../src/receiver/server.js";
import { normalizeLogRecord, normalizeSpan } from "../src/normalize/index.js";
import type { RawLogRecord, RawSpan } from "../src/receiver/raw-span.js";
import { loadFixtureBatches } from "./helpers/replay.js";

const SPEC_DIR = join(import.meta.dirname, "..", "fixtures", "spec");

/** The only attributes the reader may move out of attrs into a payload. */
const RELOCATABLE = new Set([
  "gen_ai.input.messages",
  "gen_ai.output.messages",
  "gen_ai.system_instructions",
  "gen_ai.tool.definitions",
  "gen_ai.tool.call.arguments",
  "gen_ai.tool.call.result",
  "gen_ai.retrieval.query.text",
  "gen_ai.retrieval.documents",
]);

function decode(dir: string): { spans: RawSpan[]; logs: RawLogRecord[] } {
  const spans: RawSpan[] = [];
  const logs: RawLogRecord[] = [];
  for (const batch of loadFixtureBatches(dir)) {
    handleOtlpBody(batch.path, batch.contentType, batch.contentEncoding, batch.body, {
      onSpans: (s) => spans.push(...s),
      onLogs: (l) => logs.push(...l),
    });
  }
  return { spans, logs };
}

function allowedKey(key: string, raw: Record<string, unknown>, resource: Record<string, unknown>, eventAttrKeys: Set<string>): boolean {
  if (key in raw) return true;
  if (key.startsWith("resource.") && key.slice("resource.".length) in resource) return true;
  if (key.startsWith("otel.")) return true;
  if (key.startsWith("sessionist.")) return true;
  if (eventAttrKeys.has(key)) return true; // exception span-event attrs on derived error events
  return false;
}

const scenarios = readdirSync(SPEC_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

describe("fidelity over the spec corpus", () => {
  for (const name of scenarios) {
    it(`${name}: never drops, never invents`, () => {
      const { spans, logs } = decode(join(SPEC_DIR, name));
      expect(spans.length).toBeGreaterThan(0);

      for (const span of spans) {
        const out = normalizeSpan(span);
        expect(out.length).toBeGreaterThan(0);
        const eventAttrKeys = new Set(span.events.flatMap((ev) => Object.keys(ev.attributes)));
        const anyPayload = out.some((e) => e.payload !== undefined);

        // never drop
        for (const [key, value] of Object.entries(span.attributes)) {
          const kept = out.some((e) => key in e.attrs && JSON.stringify(e.attrs[key]) === JSON.stringify(value));
          if (!kept) {
            expect(RELOCATABLE.has(key), `${name}: ${span.name} lost attribute ${key}`).toBe(true);
            expect(anyPayload, `${name}: ${span.name} relocated ${key} but has no payload`).toBe(true);
          }
        }
        for (const [key, value] of Object.entries(span.resource.attributes)) {
          // Error events projected from exception span events carry the span
          // event's attributes only; the span's own event carries the resource.
          for (const e of out.filter((x) => x.attrs["sessionist.derived"] !== "span_event")) {
            expect(e.attrs[`resource.${key}`]).toEqual(value);
          }
        }

        // never invent
        for (const e of out) {
          for (const key of Object.keys(e.attrs)) {
            expect(allowedKey(key, span.attributes, span.resource.attributes, eventAttrKeys), `${name}: ${span.name} invented attribute ${key}`).toBe(true);
          }
          expect(e.provenance.traceId).toBe(span.traceId);
          expect(e.provenance.spanId).toBe(span.spanId);
        }
      }

      for (const log of logs) {
        const out = normalizeLogRecord(log);
        for (const e of out) {
          for (const [key, value] of Object.entries(log.attributes)) {
            if (key in e.attrs) expect(e.attrs[key]).toEqual(value);
            else expect(RELOCATABLE.has(key) && e.payload !== undefined, `${name}: log ${e.name} lost attribute ${key}`).toBe(true);
          }
          for (const key of Object.keys(e.attrs)) {
            expect(allowedKey(key, log.attributes, log.resource.attributes, new Set()), `${name}: log ${e.name} invented attribute ${key}`).toBe(true);
          }
        }
      }
    });
  }
});
