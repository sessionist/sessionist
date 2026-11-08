// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// Derives the malformed fixtures from the spec corpus: truncated-protobuf (agent-tool-loop's
// batch cut to 60% of its bytes) and unrecognized-operation-json (agent-tool-loop-json with
// every gen_ai.operation.name set to "quantum_flux" and every other gen_ai.* key renamed x_ai.*).

import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..");
const SPEC = join(ROOT, "fixtures", "spec");
const MALFORMED = join(ROOT, "fixtures", "malformed");

function firstBatch(set: string, suffix: string): { body: string; headers: string; name: string } {
  const batches = join(SPEC, set, "batches");
  const name = readdirSync(batches).sort().find((f) => f.endsWith(suffix));
  if (name === undefined) throw new Error(`no ${suffix} batch in ${batches}`);
  return { body: join(batches, name), headers: join(batches, `${name.split(".")[0]}.headers.json`), name };
}

function reset(dir: string): string {
  rmSync(dir, { recursive: true, force: true });
  const batches = join(dir, "batches");
  mkdirSync(batches, { recursive: true });
  return batches;
}

function writeMeta(dir: string, meta: Record<string, unknown>): void {
  writeFileSync(join(dir, "meta.json"), JSON.stringify(meta, null, 2) + "\n");
}

function makeTruncated(): void {
  const src = firstBatch("agent-tool-loop", ".traces.pb");
  const dir = join(MALFORMED, "truncated-protobuf");
  const batches = reset(dir);
  const data = readFileSync(src.body);
  const cut = Math.floor(data.length * 0.6);
  writeFileSync(join(batches, "0001.traces.pb"), data.subarray(0, cut));
  const headers = JSON.parse(readFileSync(src.headers, "utf8")) as { path: string; headers: Record<string, string> };
  headers.headers["content-length"] = String(cut);
  writeFileSync(join(batches, "0001.headers.json"), JSON.stringify(headers, null, 2) + "\n");
  writeMeta(dir, {
    derivedFrom: `spec/agent-tool-loop/batches/${src.name}`,
    mutation: `truncated to 60% of original byte length (${cut} of ${data.length} bytes)`,
    purpose: "receiver must respond 400 and keep serving",
  });
  console.log(`truncated-protobuf: ${cut} of ${data.length} bytes`);
}

interface Json {
  [k: string]: unknown;
}

function makeUnrecognized(): void {
  const src = firstBatch("agent-tool-loop-json", ".traces.json");
  const dir = join(MALFORMED, "unrecognized-operation-json");
  const batches = reset(dir);
  const root = JSON.parse(readFileSync(src.body, "utf8")) as Json;
  for (const rs of (root["resourceSpans"] as Json[] | undefined) ?? []) {
    for (const ss of (rs["scopeSpans"] as Json[] | undefined) ?? []) {
      for (const span of (ss["spans"] as Json[] | undefined) ?? []) {
        let i = 0;
        for (const kv of (span["attributes"] as Json[] | undefined) ?? []) {
          const key = typeof kv["key"] === "string" ? (kv["key"] as string) : "";
          if (key === "gen_ai.operation.name") {
            kv["value"] = { stringValue: "quantum_flux" };
          } else if (key.startsWith("gen_ai.")) {
            if (i % 2 === 0) kv["key"] = "x_ai." + key.slice("gen_ai.".length);
            i++;
          }
        }
      }
    }
  }
  const body = JSON.stringify(root);
  writeFileSync(join(batches, "0001.traces.json"), body);
  const headers = JSON.parse(readFileSync(src.headers, "utf8")) as { path: string; headers: Record<string, string> };
  headers.headers["content-length"] = String(Buffer.byteLength(body));
  writeFileSync(join(batches, "0001.headers.json"), JSON.stringify(headers, null, 2) + "\n");
  writeMeta(dir, {
    derivedFrom: `spec/agent-tool-loop-json/batches/${src.name}`,
    mutation: "gen_ai.operation.name -> quantum_flux; every other gen_ai.* key renamed x_ai.*",
    purpose: "valid OTLP/JSON that no reader fully recognizes; must render as passthrough events, never crash",
  });
  console.log("unrecognized-operation-json: written");
}

makeTruncated();
makeUnrecognized();
