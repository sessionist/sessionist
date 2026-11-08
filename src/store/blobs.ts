// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// Content-addressed payload spillover: payloads over the inline threshold live at
// <dataDir>/blobs/<hex[0:2]>/<hex>.json, referenced from events.payload_ref as "sha256:<hex>".

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Inline threshold: UTF-8 byte length of the serialized {input, output} payload JSON, combined. */
export const PAYLOAD_INLINE_MAX_BYTES = 32 * 1024;

export function blobDir(dataDir: string): string {
  return join(dataDir, "blobs");
}

export function writeBlob(dataDir: string, serialized: string): string {
  const hex = createHash("sha256").update(serialized, "utf8").digest("hex");
  const dir = join(blobDir(dataDir), hex.slice(0, 2));
  const file = join(dir, `${hex}.json`);
  if (!existsSync(file)) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, serialized);
  }
  return `sha256:${hex}`;
}

export function readBlob(dataDir: string, ref: string): string {
  if (!ref.startsWith("sha256:")) throw new Error(`unknown payload ref scheme: ${ref}`);
  const hex = ref.slice("sha256:".length);
  const file = join(blobDir(dataDir), hex.slice(0, 2), `${hex}.json`);
  return readFileSync(file, "utf8");
}
