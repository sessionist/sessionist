// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// Replays OTLP batch files (bare .pb or .json bodies, gzipped or not, or fixture directories)
// through the real decode, normalize, and assemble pipeline and reports what happened;
// exit 0 = every file decoded, 2 = some files failed to decode, 1 = nothing decoded or usage error.

import { readFileSync, readdirSync, statSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { gunzipSync } from "node:zlib";
import { decodeTracesJson, decodeLogsJson } from "../src/receiver/decode-json.js";
import { decodeTracesProtobuf, decodeLogsProtobuf } from "../src/receiver/decode-protobuf.js";
import { normalizeLogRecord, normalizeSpan } from "../src/normalize/index.js";
import { Assembler } from "../src/assemble/assembler.js";
import { SessionStore } from "../src/store/store.js";
import { openDb } from "../src/store/db.js";
import { listEvents, listSessions } from "../src/api/query.js";
import type { RawLogRecord, RawSpan } from "../src/receiver/raw-span.js";

interface FileResult {
  file: string;
  interpretation: string; // e.g. "traces/protobuf", "logs/json (by content)"
  spans: number;
  logs: number;
  error?: string;
}

function collectFiles(paths: string[]): string[] {
  const out: string[] = [];
  for (const p of paths) {
    const stat = statSync(p);
    if (stat.isDirectory()) {
      for (const entry of readdirSync(p).sort()) {
        const full = join(p, entry);
        if (statSync(full).isDirectory()) out.push(...collectFiles([full]));
        else if (!entry.endsWith(".headers.json") && !entry.endsWith("meta.json") && !entry.startsWith("."))
          out.push(full);
      }
    } else {
      out.push(p);
    }
  }
  return out;
}

function decodeOne(file: string): { spans: RawSpan[]; logs: RawLogRecord[]; interpretation: string } {
  let body = readFileSync(file);
  let note = "";
  if (body.length >= 2 && body[0] === 0x1f && body[1] === 0x8b) {
    body = gunzipSync(body);
    note = " (gunzipped)";
  }
  const name = basename(file).toLowerCase();
  const looksJson = (() => {
    for (const byte of body.subarray(0, 32)) {
      if (byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d) continue;
      return byte === 0x7b; // '{'
    }
    return false;
  })();

  if (looksJson) {
    const text = body.toString("utf8");
    const root = JSON.parse(text) as Record<string, unknown>;
    if (root["resourceLogs"] !== undefined) {
      return { spans: [], logs: decodeLogsJson(text), interpretation: `logs/json (by content)${note}` };
    }
    return { spans: decodeTracesJson(text), logs: [], interpretation: `traces/json (by content)${note}` };
  }

  // Protobuf: filename hints pick the first attempt; a wrong-signal decode can
  // structurally "succeed" with empty ids, so require real span identity.
  const tryOrder: ("traces" | "logs")[] = name.includes("log") ? ["logs", "traces"] : ["traces", "logs"];
  let lastError: unknown;
  for (const signal of tryOrder) {
    try {
      if (signal === "traces") {
        const spans = decodeTracesProtobuf(body);
        if (spans.length > 0 && spans.some((s) => s.traceId !== "" && s.name !== "")) {
          return { spans, logs: [], interpretation: `traces/protobuf${note}` };
        }
      } else {
        const logs = decodeLogsProtobuf(body);
        if (logs.length > 0) {
          return { spans: [], logs, interpretation: `logs/protobuf${note}` };
        }
      }
    } catch (err) {
      lastError = err;
    }
  }
  if (lastError !== undefined) throw lastError;
  throw new Error("decoded to an empty batch under both signal interpretations");
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("usage: npx tsx scripts/check-fixture.ts <otlp-batch-file-or-dir> [...more]");
    process.exit(1);
  }

  const files = collectFiles(args);
  if (files.length === 0) {
    console.error("no candidate batch files found");
    process.exit(1);
  }

  const dataDir = mkdtempSync(join(tmpdir(), "sessionist-fixture-check-"));
  const db = openDb(dataDir);
  const results: FileResult[] = [];
  try {
    const store = new SessionStore(db, dataDir);
    const clock = { now: 1_756_100_000_000 };
    let n = 0;
    const assembler = new Assembler(store, {
      now: () => clock.now,
      newSessionId: () => `submitted-${String(++n).padStart(4, "0")}`,
    });

    for (const file of files) {
      try {
        const { spans, logs, interpretation } = decodeOne(file);
        assembler.ingest([
          ...spans.flatMap((s) => normalizeSpan(s)),
          ...logs.flatMap((l) => normalizeLogRecord(l)),
        ]);
        clock.now += 1000;
        results.push({ file: basename(file), interpretation, spans: spans.length, logs: logs.length });
      } catch (err) {
        results.push({
          file: basename(file),
          interpretation: "-",
          spans: 0,
          logs: 0,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    clock.now += 11 * 60 * 1000;
    assembler.sweep();

    console.log("== files ==");
    for (const r of results) {
      console.log(
        r.error !== undefined
          ? `  FAIL  ${r.file}: ${r.error}`
          : `  ok    ${r.file}  ${r.interpretation}  spans=${r.spans} logs=${r.logs}`,
      );
    }

    const sessions = listSessions(db).sessions;
    console.log(`\n== pipeline result: ${sessions.length} session(s) ==`);
    const typeCounts = new Map<string, number>();
    let withPayload = 0;
    let passthrough = 0;
    let total = 0;
    for (const session of sessions) {
      console.log(`  ${session.id}  service=${session.service ?? "-"}  events=${session.eventCount}  status=${session.status}`);
      for (const e of listEvents(db, session.id, { order: "seq", limit: 1000 }).events) {
        total++;
        typeCounts.set(e.type, (typeCounts.get(e.type) ?? 0) + 1);
        if (e.hasPayload) withPayload++;
        if (e.type === "span") passthrough++;
      }
    }
    console.log(`\n== events: ${total} ==`);
    for (const [type, count] of [...typeCounts.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(count).padStart(5)}  ${type}`);
    }
    console.log(`  payload captured on ${withPayload}/${total}; passthrough (unrecognized) ${passthrough}/${total}`);
    if (passthrough === total && total > 0) {
      console.log("  NOTE: everything landed as passthrough — no dialect recognized this telemetry.");
      console.log("  That is exactly the kind of gap a new fixture closes. Thank you.");
    }

    const failed = results.filter((r) => r.error !== undefined).length;
    process.exitCode = failed === 0 ? 0 : failed === results.length ? 1 : 2;
  } finally {
    db.close();
    rmSync(dataDir, { recursive: true, force: true });
  }
}

main();
