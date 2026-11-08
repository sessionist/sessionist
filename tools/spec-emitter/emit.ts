// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// Generates the test corpus under fixtures/spec/ by running each scenario in scenarios.ts through
// the real OTel JS SDK and OTLP exporters into a verbatim capture sink, with deterministic ids
// and timestamps.

import { mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type Attributes, type Span, SpanKind, SpanStatusCode, context, trace, type Tracer, type Logger, type SeverityNumber, type AnyValue } from "@opentelemetry/api";
import { TracerProvider, BatchSpanProcessor, type IdGenerator } from "@opentelemetry/sdk-trace";
import { LoggerProvider, BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { OTLPTraceExporter as ProtoTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { OTLPTraceExporter as JsonTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPLogExporter as ProtoLogExporter } from "@opentelemetry/exporter-logs-otlp-proto";
import { OTLPLogExporter as JsonLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { startCapture } from "./capture.js";
import { assertValid, type SchemaName } from "./validate.js";
import { SCENARIOS, type Scenario } from "./scenarios.js";

export const SPEC_REPO = "open-telemetry/semantic-conventions-genai";
export const SPEC_COMMIT = "41aad2b16ab1725eb618c5e9a0b82433e9b1c170";
const PORT = 43181;
const BASE_MS = Date.UTC(2026, 0, 1, 0, 0, 0); // 2026-01-01T00:00:00Z
const ROOT = join(import.meta.dirname, "..", "..");
const SPEC_FIXTURES = join(ROOT, "fixtures", "spec");

/** Sequential ids: trace 0000…0001, span 0000…0001, reset per scenario. */
class CounterIdGenerator implements IdGenerator {
  private traces = 0;
  private spans = 0;
  generateTraceId(): string {
    return (++this.traces).toString(16).padStart(32, "0");
  }
  generateSpanId(): string {
    return (++this.spans).toString(16).padStart(16, "0");
  }
}

export interface SpanSpec {
  name: string;
  kind?: SpanKind;
  attrs?: Attributes;
  parent?: Span;
  startMs: number; // offset from the scenario base time
  endMs: number;
  status?: { code: SpanStatusCode; message?: string };
  events?: { name: string; atMs: number; attrs?: Attributes }[];
  exception?: { atMs: number; type: string; message: string; stack?: string };
}

export interface LogSpec {
  eventName: string;
  atMs: number;
  severity: SeverityNumber;
  attrs?: Attributes;
  body?: AnyValue;
  span?: Span;
}

/** What a scenario gets: explicit-time spans and log records, and JSON
 *  content that is validated against the spec's schema before it is used. */
export class Emit {
  constructor(
    private readonly tracer: Tracer,
    private readonly logger: Logger,
    private readonly baseMs: number,
  ) {}

  at(offsetMs: number): number {
    return this.baseMs + offsetMs;
  }

  span(spec: SpanSpec): Span {
    const ctx = spec.parent !== undefined ? trace.setSpan(context.active(), spec.parent) : context.active();
    const options: { kind: SpanKind; startTime: number; root: boolean; attributes?: Attributes } = {
      kind: spec.kind ?? SpanKind.INTERNAL,
      startTime: this.at(spec.startMs),
      root: spec.parent === undefined,
    };
    if (spec.attrs !== undefined) options.attributes = spec.attrs;
    const span = this.tracer.startSpan(spec.name, options, ctx);
    for (const ev of spec.events ?? []) span.addEvent(ev.name, ev.attrs ?? {}, this.at(ev.atMs));
    if (spec.exception !== undefined) {
      const err: { name: string; message: string; stack?: string } = { name: spec.exception.type, message: spec.exception.message };
      if (spec.exception.stack !== undefined) err.stack = spec.exception.stack;
      span.recordException(err, this.at(spec.exception.atMs));
    }
    if (spec.status !== undefined) span.setStatus(spec.status);
    span.end(this.at(spec.endMs));
    return span;
  }

  log(spec: LogSpec): void {
    const ctx = spec.span !== undefined ? trace.setSpan(context.active(), spec.span) : context.active();
    const record: { eventName: string; timestamp: number; observedTimestamp: number; severityNumber: SeverityNumber; attributes?: Attributes; body?: AnyValue; context: typeof ctx } = {
      eventName: spec.eventName,
      timestamp: this.at(spec.atMs),
      observedTimestamp: this.at(spec.atMs),
      severityNumber: spec.severity,
      context: ctx,
    };
    if (spec.attrs !== undefined) record.attributes = spec.attrs;
    if (spec.body !== undefined) record.body = spec.body;
    this.logger.emit(record);
  }

  /** Validate `doc` against the named spec schema and serialize it the way
   *  instrumentations put structured content on the wire: as a JSON string. */
  json(schema: SchemaName, doc: unknown): string {
    assertValid(schema, doc);
    return JSON.stringify(doc);
  }
}

function sdkVersion(pkg: string): string {
  const p = JSON.parse(readFileSync(join(ROOT, "node_modules", "@opentelemetry", pkg, "package.json"), "utf8")) as { version: string };
  return p.version;
}

async function runScenario(scenario: Scenario): Promise<void> {
  const dir = join(SPEC_FIXTURES, scenario.name);
  rmSync(dir, { recursive: true, force: true });
  const batchesDir = join(dir, "batches");
  mkdirSync(batchesDir, { recursive: true });
  const capture = await startCapture(batchesDir, PORT);

  const resource = resourceFromAttributes({
    "service.name": "spec-emitter",
    "service.version": `spec-${SPEC_COMMIT.slice(0, 8)}`,
  });
  const json = scenario.encoding === "json";
  const traceUrl = `http://127.0.0.1:${PORT}/v1/traces`;
  const logsUrl = `http://127.0.0.1:${PORT}/v1/logs`;
  const traceExporter = json ? new JsonTraceExporter({ url: traceUrl }) : new ProtoTraceExporter({ url: traceUrl });
  const logExporter = json ? new JsonLogExporter({ url: logsUrl }) : new ProtoLogExporter({ url: logsUrl });

  const tracerProvider = new TracerProvider({
    resource,
    idGenerator: new CounterIdGenerator(),
    spanProcessors: [new BatchSpanProcessor({ exporter: traceExporter, scheduledDelayMillis: 60_000, maxExportBatchSize: 512 })],
  });
  const loggerProvider = new LoggerProvider({
    resource,
    processors: [new BatchLogRecordProcessor({ exporter: logExporter, scheduledDelayMillis: 60_000 })],
  });

  const emit = new Emit(
    tracerProvider.getTracer("sessionist.spec-emitter", "0.1.0"),
    loggerProvider.getLogger("sessionist.spec-emitter", "0.1.0"),
    BASE_MS,
  );
  await scenario.run(emit);

  await tracerProvider.forceFlush();
  await loggerProvider.forceFlush();
  await tracerProvider.shutdown();
  await loggerProvider.shutdown();
  await capture.close();

  const meta = {
    scenario: scenario.name,
    description: scenario.description,
    generatedBy: "tools/spec-emitter/emit.ts",
    spec: { repository: SPEC_REPO, commit: SPEC_COMMIT },
    encoding: scenario.encoding,
    sdk: {
      "@opentelemetry/api": sdkVersion("api"),
      "@opentelemetry/sdk-trace": sdkVersion("sdk-trace"),
      "@opentelemetry/sdk-logs": sdkVersion("sdk-logs"),
      exporters: sdkVersion("exporter-trace-otlp-proto"),
    },
    batches: capture.count(),
    notes: scenario.notes ?? "",
  };
  writeFileSync(join(dir, "meta.json"), JSON.stringify(meta, null, 2) + "\n");
  console.log(`${scenario.name}: ${capture.count()} batch(es)`);
}

async function main(): Promise<void> {
  const wanted = new Set(process.argv.slice(2));
  const selected = wanted.size === 0 ? SCENARIOS : SCENARIOS.filter((s) => wanted.has(s.name));
  if (selected.length === 0) throw new Error(`no scenario matched: ${[...wanted].join(", ")}`);
  for (const scenario of selected) await runScenario(scenario);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? (err.stack ?? err.message) : String(err));
  process.exit(1);
});
