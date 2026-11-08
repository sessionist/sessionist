// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// Exporter interface and input shape.

import type { SessionEvent, SessionSummary } from "../model/session-event.js";

export interface ExportInput {
  session: SessionSummary;
  /** Events in seq order, payloads inlined. May be a step subrange. */
  events: SessionEvent[];
}

export interface Exporter {
  name: string;
  /** Suggested file extension, without the dot. */
  extension: string;
  /** Serialize to file content. Must be deterministic: same input, same bytes. */
  export(input: ExportInput): string;
}
