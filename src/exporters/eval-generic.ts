// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// Generic eval case: a session or step clip as a harness-agnostic regression case;
// `expected` is always null for a human to fill in.

import type { ExportInput, Exporter } from "./types.js";
import { canonicalEvent } from "./session-file.js";

export const EVAL_FORMAT = "sessionist-eval/v1";

export const evalGeneric: Exporter = {
  name: "eval-generic",
  extension: "eval.json",
  export(input: ExportInput): string {
    const { session, events } = input;
    // The case input is the first captured input payload in the clip — the
    // prompt/task the run started from. Absent if the telemetry had none.
    const firstWithInput = events.find(
      (e) => e.payload !== undefined && (e.payload as { input?: unknown }).input !== undefined,
    );
    const doc = {
      format: EVAL_FORMAT,
      input: firstWithInput !== undefined ? (firstWithInput.payload as { input?: unknown }).input : null,
      expected: null, // a human fills this in; never synthesized
      trajectory: events.map((e) => canonicalEvent(e)),
      source: {
        sessionId: session.id,
        steps:
          events.length > 0 ? `${events[0]!.seq}..${events[events.length - 1]!.seq}` : "0..0",
        service: session.service ?? null,
        startedAt: session.startedAt,
      },
    };
    return JSON.stringify(doc, null, 2) + "\n";
  },
};
