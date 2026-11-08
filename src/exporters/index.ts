// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// Exporter registry.

import type { Exporter } from "./types.js";
import { sessionFile } from "./session-file.js";
import { evalGeneric } from "./eval-generic.js";
import { sessionHtml } from "./session-html.js";

export const exporters: Exporter[] = [sessionFile, evalGeneric, sessionHtml];

export function getExporter(name: string): Exporter | undefined {
  return exporters.find((e) => e.name === name);
}
