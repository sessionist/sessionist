// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// Dialect registry; order matters: first match wins, passthrough is the always-matching last resort.

import type { RawLogRecord, RawSpan } from "../receiver/raw-span.js";
import type { Dialect, NormalizedEvent } from "./types.js";
import { otelGenai } from "./otel-genai.js";
import { passthrough } from "./passthrough.js";

export const dialects: Dialect[] = [otelGenai, passthrough];

export function normalizeSpan(span: RawSpan): NormalizedEvent[] {
  for (const dialect of dialects) {
    if (dialect.matches(span)) return dialect.normalize(span);
  }
  // Unreachable: passthrough always matches.
  return passthrough.normalize(span);
}

/** Logs are a content side-channel (gen_ai message/choice records); records no dialect
 *  claims are not stored. Returns [] for unclaimed records. */
export function normalizeLogRecord(log: RawLogRecord): NormalizedEvent[] {
  for (const dialect of dialects) {
    if (dialect.matchesLog?.(log)) return dialect.normalizeLog?.(log) ?? [];
  }
  return [];
}
