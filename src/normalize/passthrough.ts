// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// Passthrough dialect: registered last with matches() === true, it turns any unclaimed span into
// a type:"span" event with every wire fact preserved verbatim in attrs.

import type { RawSpan } from "../receiver/raw-span.js";
import { nanoToIso } from "../receiver/raw-span.js";
import type { Dialect, NormalizedEvent } from "./types.js";
import {
  baseAttrsFromSpan,
  groupingFromSpan,
  spanEventsToAttr,
  statusFromSpan,
} from "./shared.js";

export const passthrough: Dialect = {
  name: "passthrough",

  matches(): boolean {
    return true;
  },

  normalize(span: RawSpan): NormalizedEvent[] {
    const attrs = baseAttrsFromSpan(span);
    const otelEvents = spanEventsToAttr(span.events);
    if (otelEvents !== undefined) attrs["otel.events"] = otelEvents;

    const event: NormalizedEvent = {
      ts: nanoToIso(span.startTimeUnixNano),
      type: "span",
      name: span.name,
      status: statusFromSpan(span),
      attrs,
      provenance: {
        traceId: span.traceId,
        spanId: span.spanId,
        dialect: "passthrough",
        captureMode: "otlp",
      },
      grouping: groupingFromSpan(span),
    };
    if (span.endTimeUnixNano > 0n && span.startTimeUnixNano > 0n) {
      event.durationMs = Number(span.endTimeUnixNano - span.startTimeUnixNano) / 1e6;
    }
    return [event];
  },
};
