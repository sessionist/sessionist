// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

import type { NormalizedEvent } from "../../src/normalize/types.js";
import type { SessionEventType } from "../../src/model/session-event.js";

let spanCounter = 0;

export interface MakeEventOpts {
  ts?: string;
  type?: SessionEventType;
  name?: string;
  status?: "ok" | "error" | "unset";
  traceId?: string;
  spanId?: string;
  conversationId?: string;
  explicitSessionId?: string;
  serviceName?: string;
  payload?: { input?: unknown; output?: unknown };
  attrs?: Record<string, unknown>;
}

export function makeEvent(opts: MakeEventOpts = {}): NormalizedEvent {
  spanCounter++;
  const grouping: NormalizedEvent["grouping"] = {};
  if (opts.conversationId !== undefined) grouping.conversationId = opts.conversationId;
  if (opts.explicitSessionId !== undefined) grouping.explicitSessionId = opts.explicitSessionId;
  if (opts.serviceName !== undefined) grouping.serviceName = opts.serviceName;
  const event: NormalizedEvent = {
    ts: opts.ts ?? "2026-01-01T00:00:00.000000000Z",
    type: opts.type ?? "llm_call",
    name: opts.name ?? "test-model",
    status: opts.status ?? "ok",
    attrs: { ...(opts.attrs ?? {}) },
    provenance: {
      traceId: opts.traceId ?? "",
      spanId: opts.spanId ?? spanCounter.toString(16).padStart(16, "0"),
      dialect: "test",
      captureMode: "otlp",
    },
    grouping,
  };
  if (opts.payload !== undefined) event.payload = opts.payload;
  return event;
}
