// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// Every attribute name and operation value below is taken from the GenAI semantic conventions at
// the pinned commit (schema/SOURCE.md), and content documents are validated against the spec's
// JSON schemas before they go on a span.

import { SpanKind, SpanStatusCode, SeverityNumber, type Attributes, type Span } from "@opentelemetry/api";
import type { Emit } from "./emit.js";

export interface Scenario {
  name: string;
  description: string;
  encoding: "protobuf" | "json";
  notes?: string;
  run(e: Emit): void | Promise<void>;
}

// ---------------------------------------------------------------- content

const SYSTEM = [{ type: "text", content: "You are a weather assistant. Use the get_weather tool when asked about conditions." }];
const USER_Q = { role: "user", parts: [{ type: "text", content: "What's the weather in Paris?" }] };
const ASSISTANT_TOOL_CALL = {
  role: "assistant",
  parts: [{ type: "tool_call", id: "call_0001", name: "get_weather", arguments: { location: "Paris" } }],
};
const TOOL_RESULT = { conditions: "rainy", temperature_f: 57 };
const TOOL_RESPONSE = {
  role: "tool",
  parts: [{ type: "tool_call_response", id: "call_0001", response: TOOL_RESULT }],
};
const ASSISTANT_FINAL = { role: "assistant", parts: [{ type: "text", content: "It's rainy in Paris, 57°F." }] };

const CONV = "conv-0001";

// ---------------------------------------------------------------- helpers

interface ChatOpts {
  parent?: Span;
  startMs: number;
  endMs: number;
  input?: unknown[];
  output?: unknown[];
  system?: unknown[];
  conversationId?: string;
  responseId?: string;
  finishReasons?: string[];
  extra?: Attributes;
  status?: { code: SpanStatusCode; message?: string };
  exception?: { atMs: number; type: string; message: string; stack?: string };
  content?: boolean; // false = metadata-only span (content elsewhere)
}

function chat(e: Emit, o: ChatOpts): Span {
  const attrs: Attributes = {
    "gen_ai.operation.name": "chat",
    "gen_ai.provider.name": "spec-emitter",
    "gen_ai.request.model": "spec-model",
    "gen_ai.response.model": "spec-model-2026-01",
    "gen_ai.response.id": o.responseId ?? "resp_0001",
    "gen_ai.response.finish_reasons": o.finishReasons ?? ["stop"],
    "gen_ai.usage.input_tokens": 42,
    "gen_ai.usage.output_tokens": 18,
    ...(o.extra ?? {}),
  };
  if (o.conversationId !== undefined) attrs["gen_ai.conversation.id"] = o.conversationId;
  if (o.content !== false) {
    if (o.system !== undefined) attrs["gen_ai.system_instructions"] = e.json("gen-ai-system-instructions", o.system);
    if (o.input !== undefined) attrs["gen_ai.input.messages"] = e.json("gen-ai-input-messages", o.input);
    if (o.output !== undefined) attrs["gen_ai.output.messages"] = e.json("gen-ai-output-messages", o.output);
  }
  const spec: Parameters<Emit["span"]>[0] = {
    name: "chat spec-model",
    kind: SpanKind.CLIENT,
    attrs,
    startMs: o.startMs,
    endMs: o.endMs,
  };
  if (o.parent !== undefined) spec.parent = o.parent;
  if (o.status !== undefined) spec.status = o.status;
  if (o.exception !== undefined) spec.exception = o.exception;
  return e.span(spec);
}

interface AgentOpts {
  name: string;
  parent?: Span;
  startMs: number;
  endMs: number;
  conversationId?: string;
  input?: unknown[];
  output?: unknown[];
  extra?: Attributes;
  status?: { code: SpanStatusCode; message?: string };
}

function agent(e: Emit, o: AgentOpts): Span {
  const attrs: Attributes = {
    "gen_ai.operation.name": "invoke_agent",
    "gen_ai.agent.name": o.name,
    "gen_ai.agent.id": `agent_${o.name}`,
    "gen_ai.provider.name": "spec-emitter",
    ...(o.extra ?? {}),
  };
  if (o.conversationId !== undefined) attrs["gen_ai.conversation.id"] = o.conversationId;
  if (o.input !== undefined) attrs["gen_ai.input.messages"] = e.json("gen-ai-input-messages", o.input);
  if (o.output !== undefined) attrs["gen_ai.output.messages"] = e.json("gen-ai-output-messages", o.output);
  const spec: Parameters<Emit["span"]>[0] = {
    name: `invoke_agent ${o.name}`,
    kind: SpanKind.INTERNAL,
    attrs,
    startMs: o.startMs,
    endMs: o.endMs,
  };
  if (o.parent !== undefined) spec.parent = o.parent;
  if (o.status !== undefined) spec.status = o.status;
  return e.span(spec);
}

interface ToolOpts {
  parent?: Span;
  startMs: number;
  endMs: number;
  name?: string;
  callId?: string;
  args?: Record<string, unknown>;
  result?: Record<string, unknown>;
  extra?: Attributes;
  status?: { code: SpanStatusCode; message?: string };
  spanName?: string;
  kind?: SpanKind;
}

function tool(e: Emit, o: ToolOpts): Span {
  const name = o.name ?? "get_weather";
  const attrs: Attributes = {
    "gen_ai.operation.name": "execute_tool",
    "gen_ai.tool.name": name,
    "gen_ai.tool.call.id": o.callId ?? "call_0001",
    "gen_ai.tool.type": "function",
    ...(o.extra ?? {}),
  };
  if (o.args !== undefined) attrs["gen_ai.tool.call.arguments"] = e.json("gen-ai-tool-call-arguments", o.args);
  if (o.result !== undefined) attrs["gen_ai.tool.call.result"] = e.json("gen-ai-tool-call-result", o.result);
  const spec: Parameters<Emit["span"]>[0] = {
    name: o.spanName ?? `execute_tool ${name}`,
    kind: o.kind ?? SpanKind.INTERNAL,
    attrs,
    startMs: o.startMs,
    endMs: o.endMs,
  };
  if (o.parent !== undefined) spec.parent = o.parent;
  if (o.status !== undefined) spec.status = o.status;
  return e.span(spec);
}

/** The canonical run: agent → chat (tool call) → tool → chat (answer). */
function toolLoop(e: Emit, conversationId: string | undefined, extra: Attributes = {}, baseMs = 0): Span {
  const a = agent(e, {
    name: "weather-agent",
    startMs: baseMs,
    endMs: baseMs + 1000,
    input: [USER_Q],
    output: [ASSISTANT_FINAL],
    extra,
    ...(conversationId !== undefined ? { conversationId } : {}),
  });
  chat(e, {
    parent: a,
    startMs: baseMs + 50,
    endMs: baseMs + 300,
    system: SYSTEM,
    input: [USER_Q],
    output: [ASSISTANT_TOOL_CALL],
    finishReasons: ["tool_call"],
    responseId: "resp_0001",
    extra,
    ...(conversationId !== undefined ? { conversationId } : {}),
  });
  tool(e, { parent: a, startMs: baseMs + 310, endMs: baseMs + 400, args: { location: "Paris" }, result: TOOL_RESULT, extra });
  chat(e, {
    parent: a,
    startMs: baseMs + 410,
    endMs: baseMs + 900,
    system: SYSTEM,
    input: [USER_Q, ASSISTANT_TOOL_CALL, TOOL_RESPONSE],
    output: [ASSISTANT_FINAL],
    responseId: "resp_0002",
    extra,
    ...(conversationId !== undefined ? { conversationId } : {}),
  });
  return a;
}

const MCP_SESSION: Attributes = {
  "mcp.session.id": "8267461134f24305af708e66b8eda71a",
  "mcp.protocol.version": "2025-06-18",
  "network.transport": "pipe",
};

// ---------------------------------------------------------------- scenarios

export const SCENARIOS: Scenario[] = [
  {
    name: "agent-tool-loop",
    description:
      "invoke_agent bracket; two chat spans; one execute_tool whose gen_ai.tool.call.id matches the model's tool_call part; content on span attributes; gen_ai.system_instructions; gen_ai.conversation.id; usage attributes; protobuf.",
    encoding: "protobuf",
    run: (e) => void toolLoop(e, CONV),
  },
  {
    name: "agent-tool-loop-json",
    description: "The same run as agent-tool-loop, exported as OTLP/JSON.",
    encoding: "json",
    run: (e) => void toolLoop(e, CONV),
  },
  {
    name: "content-as-log-record",
    description:
      "Metadata-only chat spans plus gen_ai.client.inference.operation.details log records carrying the messages: the other current content form, on the logs signal.",
    encoding: "protobuf",
    run: (e) => {
      const a = agent(e, { name: "weather-agent", startMs: 0, endMs: 1000, conversationId: CONV });
      const c1 = chat(e, { parent: a, startMs: 50, endMs: 300, conversationId: CONV, finishReasons: ["tool_call"], content: false });
      e.log({
        eventName: "gen_ai.client.inference.operation.details",
        atMs: 300,
        severity: SeverityNumber.DEBUG,
        span: c1,
        attrs: {
          "gen_ai.operation.name": "chat",
          "gen_ai.provider.name": "spec-emitter",
          "gen_ai.request.model": "spec-model",
          "gen_ai.conversation.id": CONV,
          "gen_ai.system_instructions": e.json("gen-ai-system-instructions", SYSTEM),
          "gen_ai.input.messages": e.json("gen-ai-input-messages", [USER_Q]),
          "gen_ai.output.messages": e.json("gen-ai-output-messages", [ASSISTANT_TOOL_CALL]),
        },
      });
      tool(e, { parent: a, startMs: 310, endMs: 400, args: { location: "Paris" }, result: TOOL_RESULT });
      const c2 = chat(e, { parent: a, startMs: 410, endMs: 900, conversationId: CONV, responseId: "resp_0002", content: false });
      e.log({
        eventName: "gen_ai.client.inference.operation.details",
        atMs: 900,
        severity: SeverityNumber.DEBUG,
        span: c2,
        attrs: {
          "gen_ai.operation.name": "chat",
          "gen_ai.provider.name": "spec-emitter",
          "gen_ai.request.model": "spec-model",
          "gen_ai.conversation.id": CONV,
          "gen_ai.input.messages": e.json("gen-ai-input-messages", [USER_Q, ASSISTANT_TOOL_CALL, TOOL_RESPONSE]),
          "gen_ai.output.messages": e.json("gen-ai-output-messages", [ASSISTANT_FINAL]),
        },
      });
    },
  },
  {
    name: "error-path",
    description:
      "A chat span with error status, error.type, and an exception span event; an execute_tool span with error status; the agent bracket closes with error status.",
    encoding: "protobuf",
    run: (e) => {
      const a = agent(e, {
        name: "weather-agent",
        startMs: 0,
        endMs: 1000,
        conversationId: CONV,
        input: [USER_Q],
        status: { code: SpanStatusCode.ERROR, message: "tool failed" },
        extra: { "error.type": "ToolExecutionError" },
      });
      chat(e, { parent: a, startMs: 50, endMs: 300, conversationId: CONV, system: SYSTEM, input: [USER_Q], output: [ASSISTANT_TOOL_CALL], finishReasons: ["tool_call"] });
      tool(e, {
        parent: a,
        startMs: 310,
        endMs: 400,
        args: { location: "Paris" },
        status: { code: SpanStatusCode.ERROR, message: "upstream timeout" },
        extra: { "error.type": "TimeoutError" },
      });
      chat(e, {
        parent: a,
        startMs: 410,
        endMs: 900,
        conversationId: CONV,
        system: SYSTEM,
        input: [USER_Q, ASSISTANT_TOOL_CALL],
        responseId: "resp_0002",
        finishReasons: ["error"],
        status: { code: SpanStatusCode.ERROR, message: "429 Too Many Requests" },
        extra: { "error.type": "RateLimitError" },
        exception: { atMs: 890, type: "RateLimitError", message: "429 Too Many Requests", stack: "RateLimitError: 429 Too Many Requests\n    at spec-emitter (scenarios.ts:1:1)" },
      });
    },
  },
  {
    name: "no-conversation-id",
    description:
      "Two complete runs with no gen_ai.conversation.id and no session.id. Grouping falls to the same-service time window; in one replay window they land in one session, which is the rule working as written.",
    encoding: "protobuf",
    notes: "The assembler's idle gap is wall-clock, so two runs in one batch share a session. The gap-closing rule itself is covered by tests/assembler.test.ts with synthetic events.",
    run: (e) => {
      toolLoop(e, undefined, {}, 0);
      toolLoop(e, undefined, {}, 5000);
    },
  },
  {
    name: "explicit-session-id",
    description: "session.id present on every span and gen_ai.conversation.id absent: the second grouping rule.",
    encoding: "protobuf",
    run: (e) => void toolLoop(e, undefined, { "session.id": "app-session-0042" }),
  },
  {
    name: "subagent",
    description: "An outer invoke_agent containing a chat, a child invoke_agent (with its own chat, tool, chat), then a final outer chat: nesting from the parent chain.",
    encoding: "protobuf",
    run: (e) => {
      const outer = agent(e, { name: "planner", startMs: 0, endMs: 2000, conversationId: CONV, input: [USER_Q], output: [ASSISTANT_FINAL] });
      chat(e, { parent: outer, startMs: 50, endMs: 300, conversationId: CONV, system: SYSTEM, input: [USER_Q], output: [{ role: "assistant", parts: [{ type: "text", content: "Delegating to weather-agent." }] }] });
      const inner = agent(e, { name: "weather-agent", parent: outer, startMs: 350, endMs: 1500, conversationId: CONV, input: [USER_Q], output: [ASSISTANT_FINAL] });
      chat(e, { parent: inner, startMs: 400, endMs: 700, conversationId: CONV, system: SYSTEM, input: [USER_Q], output: [ASSISTANT_TOOL_CALL], finishReasons: ["tool_call"] });
      tool(e, { parent: inner, startMs: 710, endMs: 800, args: { location: "Paris" }, result: TOOL_RESULT });
      chat(e, { parent: inner, startMs: 810, endMs: 1400, conversationId: CONV, system: SYSTEM, input: [USER_Q, ASSISTANT_TOOL_CALL, TOOL_RESPONSE], output: [ASSISTANT_FINAL], responseId: "resp_0002" });
      chat(e, { parent: outer, startMs: 1600, endMs: 1900, conversationId: CONV, system: SYSTEM, input: [USER_Q, ASSISTANT_FINAL], output: [ASSISTANT_FINAL], responseId: "resp_0003" });
    },
  },
  {
    name: "other-operations",
    description:
      "embeddings, text_completion, generate_content (inference operations, become model calls); create_agent and plan (convention operations that stay plain spans); one operation name outside the convention (stays a plain span, nothing guessed).",
    encoding: "protobuf",
    run: (e) => {
      const a = agent(e, { name: "weather-agent", startMs: 0, endMs: 2000, conversationId: CONV });
      e.span({
        name: "create_agent weather-agent",
        kind: SpanKind.CLIENT,
        parent: a,
        startMs: 10,
        endMs: 40,
        attrs: { "gen_ai.operation.name": "create_agent", "gen_ai.provider.name": "spec-emitter", "gen_ai.agent.name": "weather-agent", "gen_ai.agent.id": "agent_weather-agent", "gen_ai.agent.description": "Answers weather questions with the get_weather tool.", "gen_ai.conversation.id": CONV },
      });
      e.span({
        name: "plan weather-agent",
        kind: SpanKind.INTERNAL,
        parent: a,
        startMs: 50,
        endMs: 120,
        attrs: { "gen_ai.operation.name": "plan", "gen_ai.agent.name": "weather-agent", "gen_ai.conversation.id": CONV },
      });
      e.span({
        name: "embeddings spec-embed",
        kind: SpanKind.CLIENT,
        parent: a,
        startMs: 130,
        endMs: 200,
        attrs: { "gen_ai.operation.name": "embeddings", "gen_ai.provider.name": "spec-emitter", "gen_ai.request.model": "spec-embed", "gen_ai.embeddings.dimension.count": 1536, "gen_ai.usage.input_tokens": 8, "gen_ai.conversation.id": CONV },
      });
      e.span({
        name: "text_completion spec-model",
        kind: SpanKind.CLIENT,
        parent: a,
        startMs: 210,
        endMs: 500,
        attrs: { "gen_ai.operation.name": "text_completion", "gen_ai.provider.name": "spec-emitter", "gen_ai.request.model": "spec-model", "gen_ai.conversation.id": CONV, "gen_ai.input.messages": e.json("gen-ai-input-messages", [USER_Q]), "gen_ai.output.messages": e.json("gen-ai-output-messages", [ASSISTANT_FINAL]), "gen_ai.usage.input_tokens": 12, "gen_ai.usage.output_tokens": 9 },
      });
      e.span({
        name: "generate_content spec-model",
        kind: SpanKind.CLIENT,
        parent: a,
        startMs: 510,
        endMs: 800,
        attrs: { "gen_ai.operation.name": "generate_content", "gen_ai.provider.name": "spec-emitter", "gen_ai.request.model": "spec-model", "gen_ai.conversation.id": CONV, "gen_ai.output.type": "text", "gen_ai.input.messages": e.json("gen-ai-input-messages", [USER_Q]), "gen_ai.output.messages": e.json("gen-ai-output-messages", [ASSISTANT_FINAL]) },
      });
      e.span({
        name: "summon_dragon",
        kind: SpanKind.INTERNAL,
        parent: a,
        startMs: 810,
        endMs: 900,
        attrs: { "gen_ai.operation.name": "summon_dragon", "gen_ai.provider.name": "spec-emitter", "gen_ai.conversation.id": CONV },
      });
    },
  },
  {
    name: "passthrough-mixed",
    description: "Convention spans interleaved with HTTP client and database spans in one trace: never dropped, nested as recorded.",
    encoding: "protobuf",
    run: (e) => {
      const a = agent(e, { name: "weather-agent", startMs: 0, endMs: 1000, conversationId: CONV, input: [USER_Q], output: [ASSISTANT_FINAL] });
      chat(e, { parent: a, startMs: 50, endMs: 300, conversationId: CONV, system: SYSTEM, input: [USER_Q], output: [ASSISTANT_TOOL_CALL], finishReasons: ["tool_call"] });
      const t = tool(e, { parent: a, startMs: 310, endMs: 400, args: { location: "Paris" }, result: TOOL_RESULT });
      e.span({
        name: "GET",
        kind: SpanKind.CLIENT,
        parent: t,
        startMs: 315,
        endMs: 380,
        attrs: { "http.request.method": "GET", "url.full": "https://weather.example.test/v1/current?city=Paris", "server.address": "weather.example.test", "server.port": 443, "http.response.status_code": 200 },
      });
      e.span({
        name: "SELECT weather_cache",
        kind: SpanKind.CLIENT,
        parent: t,
        startMs: 382,
        endMs: 395,
        attrs: { "db.system.name": "sqlite", "db.operation.name": "SELECT", "db.collection.name": "weather_cache", "db.query.text": "SELECT payload FROM weather_cache WHERE city = ?" },
      });
      chat(e, { parent: a, startMs: 410, endMs: 900, conversationId: CONV, system: SYSTEM, input: [USER_Q, ASSISTANT_TOOL_CALL, TOOL_RESPONSE], output: [ASSISTANT_FINAL], responseId: "resp_0002" });
    },
  },
  {
    name: "large-payload",
    description: "A chat whose input message array is over the 32 KB blob threshold: the store's spillover path, byte-equal on the way back out.",
    encoding: "protobuf",
    run: (e) => {
      const sentence = "The forecast archive for Paris lists rain on most October days, with brief clear spells in the afternoon. ";
      const document = sentence.repeat(420); // ~45 KB
      const a = agent(e, { name: "weather-agent", startMs: 0, endMs: 1000, conversationId: CONV });
      chat(e, {
        parent: a,
        startMs: 50,
        endMs: 900,
        conversationId: CONV,
        system: SYSTEM,
        input: [{ role: "user", parts: [{ type: "text", content: `Summarize this archive:\n${document}` }] }],
        output: [{ role: "assistant", parts: [{ type: "text", content: "Mostly rain, with afternoon clearings." }] }],
        extra: { "gen_ai.usage.input_tokens": 11200, "gen_ai.usage.output_tokens": 9 },
      });
    },
  },
  {
    name: "content-by-reference",
    description: "gen_ai.input.messages_ref, gen_ai.output.messages_ref, and gen_ai.system_instructions_ref URIs with no inline content: the sink records the reference as the payload source and never fetches.",
    encoding: "protobuf",
    run: (e) => {
      const a = agent(e, { name: "weather-agent", startMs: 0, endMs: 1000, conversationId: CONV });
      chat(e, {
        parent: a,
        startMs: 50,
        endMs: 900,
        conversationId: CONV,
        content: false,
        extra: {
          "gen_ai.system_instructions_ref": "s3://spec-emitter/run-0001/chat-0001/system.json",
          "gen_ai.input.messages_ref": "s3://spec-emitter/run-0001/chat-0001/input.json",
          "gen_ai.output.messages_ref": "s3://spec-emitter/run-0001/chat-0001/output.json",
        },
      });
    },
  },
  {
    name: "workflow-and-plan",
    description: "invoke_workflow containing a plan span and an invoke_agent with its chat and tool: the workflow renders as a bracket, the plan as a plain span.",
    encoding: "protobuf",
    run: (e) => {
      const w = e.span({
        name: "invoke_workflow daily-report",
        kind: SpanKind.INTERNAL,
        startMs: 0,
        endMs: 2000,
        attrs: { "gen_ai.operation.name": "invoke_workflow", "gen_ai.workflow.name": "daily-report", "gen_ai.provider.name": "spec-emitter", "gen_ai.conversation.id": CONV },
      });
      e.span({
        name: "plan daily-report",
        kind: SpanKind.INTERNAL,
        parent: w,
        startMs: 10,
        endMs: 100,
        attrs: { "gen_ai.operation.name": "plan", "gen_ai.conversation.id": CONV },
      });
      const a = agent(e, { name: "weather-agent", parent: w, startMs: 120, endMs: 1500, conversationId: CONV, input: [USER_Q], output: [ASSISTANT_FINAL] });
      chat(e, { parent: a, startMs: 150, endMs: 400, conversationId: CONV, system: SYSTEM, input: [USER_Q], output: [ASSISTANT_TOOL_CALL], finishReasons: ["tool_call"] });
      tool(e, { parent: a, startMs: 410, endMs: 500, args: { location: "Paris" }, result: TOOL_RESULT });
      chat(e, { parent: a, startMs: 510, endMs: 1400, conversationId: CONV, system: SYSTEM, input: [USER_Q, ASSISTANT_TOOL_CALL, TOOL_RESPONSE], output: [ASSISTANT_FINAL], responseId: "resp_0002" });
    },
  },
  {
    name: "retrieval",
    description: "A retrieval span (gen_ai.operation.name = retrieval) with gen_ai.retrieval.query.text, gen_ai.retrieval.top_k, and gen_ai.retrieval.documents, before the chat that uses it.",
    encoding: "protobuf",
    run: (e) => {
      const a = agent(e, { name: "policy-agent", startMs: 0, endMs: 1000, conversationId: CONV, input: [{ role: "user", parts: [{ type: "text", content: "What is the rain policy?" }] }] });
      e.span({
        name: "retrieval docs-index",
        kind: SpanKind.CLIENT,
        parent: a,
        startMs: 20,
        endMs: 120,
        attrs: {
          "gen_ai.operation.name": "retrieval",
          "gen_ai.provider.name": "spec-emitter",
          "gen_ai.data_source.id": "docs-index",
          "gen_ai.retrieval.query.text": "rain policy",
          "gen_ai.retrieval.top_k": 3,
          "gen_ai.retrieval.documents": e.json("gen-ai-retrieval-documents", [
            { id: "doc_123", score: 0.95 },
            { id: "doc_456", score: 0.87 },
            { id: "doc_789", score: 0.82 },
          ]),
          "gen_ai.conversation.id": CONV,
        },
      });
      chat(e, {
        parent: a,
        startMs: 130,
        endMs: 900,
        conversationId: CONV,
        system: SYSTEM,
        input: [{ role: "user", parts: [{ type: "text", content: "What is the rain policy?" }, { type: "text", content: "Context: doc_123, doc_456, doc_789" }] }],
        output: [{ role: "assistant", parts: [{ type: "text", content: "Events move indoors when rain is forecast." }] }],
      });
    },
  },
  {
    name: "mcp-tool-call",
    description:
      "The spec's own MCP example: invoke_agent → chat → MCP client span `tools/call get-weather` (CLIENT, gen_ai.operation.name = execute_tool, tool IO, mcp.* attributes) → nested MCP server span (SERVER, same attributes) → chat. Both MCP spans render as tool calls; server nested under client; never deduplicated.",
    encoding: "protobuf",
    run: (e) => {
      const a = agent(e, { name: "weather-forecast-agent", startMs: 0, endMs: 1000, conversationId: CONV, input: [USER_Q], output: [ASSISTANT_FINAL] });
      chat(e, { parent: a, startMs: 50, endMs: 300, conversationId: CONV, system: SYSTEM, input: [USER_Q], output: [{ role: "assistant", parts: [{ type: "tool_call", id: "call_0001", name: "get-weather", arguments: { location: "Paris", date: "2026-01-01" } }] }], finishReasons: ["tool_call"] });
      const mcpArgs = { location: "Paris", date: "2026-01-01" };
      const mcpResult = { temperature_range: { high: 75, low: 60 } };
      const client = tool(e, {
        parent: a,
        startMs: 310,
        endMs: 420,
        name: "get-weather",
        spanName: "tools/call get-weather",
        kind: SpanKind.CLIENT,
        args: mcpArgs,
        result: mcpResult,
        extra: { "jsonrpc.request.id": "3", "mcp.method.name": "tools/call", ...MCP_SESSION },
      });
      tool(e, {
        parent: client,
        startMs: 320,
        endMs: 410,
        name: "get-weather",
        spanName: "tools/call get-weather",
        kind: SpanKind.SERVER,
        args: mcpArgs,
        result: mcpResult,
        extra: { "jsonrpc.request.id": "3", "mcp.method.name": "tools/call", ...MCP_SESSION },
      });
      chat(e, {
        parent: a,
        startMs: 430,
        endMs: 900,
        conversationId: CONV,
        system: SYSTEM,
        input: [USER_Q, { role: "assistant", parts: [{ type: "tool_call", id: "call_0001", name: "get-weather", arguments: mcpArgs }] }, { role: "tool", parts: [{ type: "tool_call_response", id: "call_0001", response: mcpResult }] }],
        output: [{ role: "assistant", parts: [{ type: "text", content: "Between 60 and 75°F in Paris." }] }],
        responseId: "resp_0002",
      });
    },
  },
  {
    name: "mcp-session",
    description: "MCP operations that are not tool calls (initialize, tools/list, resources/read) as client spans with server children: no gen_ai.* attributes by the spec's own rule, so they land as passthrough spans nested under the agent.",
    encoding: "protobuf",
    run: (e) => {
      const a = agent(e, { name: "weather-forecast-agent", startMs: 0, endMs: 1000, conversationId: CONV });
      const init = e.span({ name: "initialize", kind: SpanKind.CLIENT, parent: a, startMs: 10, endMs: 60, attrs: { "jsonrpc.request.id": "1", "mcp.method.name": "initialize", ...MCP_SESSION } });
      e.span({ name: "initialize", kind: SpanKind.SERVER, parent: init, startMs: 15, endMs: 55, attrs: { "jsonrpc.request.id": "1", "mcp.method.name": "initialize", ...MCP_SESSION } });
      const list = e.span({ name: "tools/list", kind: SpanKind.CLIENT, parent: a, startMs: 70, endMs: 110, attrs: { "jsonrpc.request.id": "2", "mcp.method.name": "tools/list", ...MCP_SESSION } });
      e.span({ name: "tools/list", kind: SpanKind.SERVER, parent: list, startMs: 75, endMs: 105, attrs: { "jsonrpc.request.id": "2", "mcp.method.name": "tools/list", ...MCP_SESSION } });
      e.span({ name: "resources/read file:///docs/policy.md", kind: SpanKind.CLIENT, parent: a, startMs: 120, endMs: 180, attrs: { "jsonrpc.request.id": "4", "mcp.method.name": "resources/read", "mcp.resource.uri": "file:///docs/policy.md", ...MCP_SESSION } });
      chat(e, { parent: a, startMs: 200, endMs: 900, conversationId: CONV, system: SYSTEM, input: [USER_Q], output: [ASSISTANT_FINAL] });
    },
  },
  {
    name: "agent-transfer",
    description: "An execute_tool span carrying gen_ai.transfer.mode and gen_ai.transfer.target.name (the spec's agent-as-a-tool refinement), followed by the target's invoke_agent: a handoff event, then the nested agent.",
    encoding: "protobuf",
    run: (e) => {
      const triage = agent(e, { name: "triage", startMs: 0, endMs: 2000, conversationId: CONV, input: [USER_Q], output: [ASSISTANT_FINAL] });
      chat(e, { parent: triage, startMs: 50, endMs: 300, conversationId: CONV, system: SYSTEM, input: [USER_Q], output: [{ role: "assistant", parts: [{ type: "tool_call", id: "call_0001", name: "transfer_to_weather_agent", arguments: {} }] }], finishReasons: ["tool_call"] });
      tool(e, {
        parent: triage,
        startMs: 310,
        endMs: 1600,
        name: "transfer_to_weather_agent",
        args: {},
        result: { transferred: true },
        extra: { "gen_ai.transfer.mode": "pass_control", "gen_ai.transfer.target.name": "weather_agent" },
      });
      const target = agent(e, { name: "weather_agent", parent: triage, startMs: 350, endMs: 1500, conversationId: CONV, input: [USER_Q], output: [ASSISTANT_FINAL] });
      chat(e, { parent: target, startMs: 400, endMs: 700, conversationId: CONV, system: SYSTEM, input: [USER_Q], output: [ASSISTANT_TOOL_CALL], finishReasons: ["tool_call"] });
      tool(e, { parent: target, startMs: 710, endMs: 800, callId: "call_0002", args: { location: "Paris" }, result: TOOL_RESULT });
      chat(e, { parent: target, startMs: 810, endMs: 1400, conversationId: CONV, system: SYSTEM, input: [USER_Q, ASSISTANT_TOOL_CALL, TOOL_RESPONSE], output: [ASSISTANT_FINAL], responseId: "resp_0002" });
    },
  },
  {
    name: "skills",
    description: "The spec's execute_tool refinements for agent skills: load_skill and read_skill_resource spans with gen_ai.skill.name, rendered as tool calls with attributes preserved.",
    encoding: "protobuf",
    run: (e) => {
      const a = agent(e, { name: "report-agent", startMs: 0, endMs: 1000, conversationId: CONV });
      tool(e, {
        parent: a,
        startMs: 20,
        endMs: 80,
        name: "load_skill",
        spanName: "execute_tool load_skill pdf-reader",
        args: { skill: "pdf-reader" },
        result: { loaded: true },
        extra: { "gen_ai.skill.name": "pdf-reader" },
      });
      tool(e, {
        parent: a,
        startMs: 90,
        endMs: 140,
        name: "read_skill_resource",
        callId: "call_0002",
        spanName: "execute_tool read_skill_resource pdf-reader",
        args: { skill: "pdf-reader", path: "reference/layout.md" },
        result: { bytes: 2048 },
        extra: { "gen_ai.skill.name": "pdf-reader" },
      });
      chat(e, { parent: a, startMs: 150, endMs: 900, conversationId: CONV, system: SYSTEM, input: [USER_Q], output: [ASSISTANT_FINAL] });
    },
  },
  {
    name: "fetch-response",
    description: "A fetch_response span (a previously generated response fetched by id, no inference) with gen_ai.output.messages and gen_ai.request.previous_response.id: a model call with output only.",
    encoding: "protobuf",
    run: (e) => {
      const a = agent(e, { name: "weather-agent", startMs: 0, endMs: 1000, conversationId: CONV });
      chat(e, { parent: a, startMs: 50, endMs: 300, conversationId: CONV, system: SYSTEM, input: [USER_Q], output: [ASSISTANT_FINAL], responseId: "resp_0001" });
      e.span({
        name: "fetch_response spec-model",
        kind: SpanKind.CLIENT,
        parent: a,
        startMs: 400,
        endMs: 450,
        attrs: {
          "gen_ai.operation.name": "fetch_response",
          "gen_ai.provider.name": "spec-emitter",
          "gen_ai.response.id": "resp_0001",
          "gen_ai.response.model": "spec-model-2026-01",
          "gen_ai.request.previous_response.id": "resp_0000",
          "gen_ai.response.finish_reasons": ["stop"],
          "gen_ai.output.messages": e.json("gen-ai-output-messages", [ASSISTANT_FINAL]),
          "gen_ai.conversation.id": CONV,
        },
      });
    },
  },
  {
    name: "memory-operations",
    description: "create_memory_store, upsert_memory, search_memory, delete_memory with gen_ai.memory.store.id: convention operations that stay plain spans with attributes preserved.",
    encoding: "protobuf",
    run: (e) => {
      const a = agent(e, { name: "weather-agent", startMs: 0, endMs: 1000, conversationId: CONV });
      const base: Attributes = { "gen_ai.provider.name": "spec-emitter", "gen_ai.memory.store.id": "user-prefs", "gen_ai.conversation.id": CONV };
      e.span({ name: "create_memory_store user-prefs", kind: SpanKind.CLIENT, parent: a, startMs: 10, endMs: 40, attrs: { "gen_ai.operation.name": "create_memory_store", ...base } });
      e.span({ name: "upsert_memory user-prefs", kind: SpanKind.CLIENT, parent: a, startMs: 50, endMs: 80, attrs: { "gen_ai.operation.name": "upsert_memory", ...base, "gen_ai.memory.records": e.json("gen-ai-memory-records", [{ id: "mem_0001", content: "User prefers Fahrenheit." }]) } });
      e.span({ name: "search_memory user-prefs", kind: SpanKind.CLIENT, parent: a, startMs: 90, endMs: 130, attrs: { "gen_ai.operation.name": "search_memory", ...base } });
      chat(e, { parent: a, startMs: 140, endMs: 800, conversationId: CONV, system: SYSTEM, input: [USER_Q], output: [ASSISTANT_FINAL] });
      e.span({ name: "delete_memory user-prefs", kind: SpanKind.CLIENT, parent: a, startMs: 820, endMs: 850, attrs: { "gen_ai.operation.name": "delete_memory", ...base } });
    },
  },
  {
    name: "exception-log-event",
    description: "A chat span with error status plus a gen_ai.client.operation.exception log record at WARN carrying exception.type, exception.message, and exception.stacktrace: an error event on the logs signal.",
    encoding: "protobuf",
    run: (e) => {
      const a = agent(e, { name: "weather-agent", startMs: 0, endMs: 1000, conversationId: CONV, status: { code: SpanStatusCode.ERROR } });
      const c = chat(e, {
        parent: a,
        startMs: 50,
        endMs: 300,
        conversationId: CONV,
        system: SYSTEM,
        input: [USER_Q],
        finishReasons: ["error"],
        status: { code: SpanStatusCode.ERROR, message: "429 Too Many Requests" },
        extra: { "error.type": "RateLimitError" },
      });
      e.log({
        eventName: "gen_ai.client.operation.exception",
        atMs: 300,
        severity: SeverityNumber.WARN,
        span: c,
        attrs: {
          "exception.type": "RateLimitError",
          "exception.message": "429 Too Many Requests",
          "exception.stacktrace": "RateLimitError: 429 Too Many Requests\n    at spec-emitter (scenarios.ts:1:1)",
          "gen_ai.operation.name": "chat",
          "gen_ai.provider.name": "spec-emitter",
          "gen_ai.request.model": "spec-model",
          "gen_ai.conversation.id": CONV,
        },
      });
    },
  },
  {
    name: "evaluation-event",
    description: "A gen_ai.evaluation.result log record parented to a chat span: passthrough, attributes preserved, no verdict adopted (observation, not evaluation).",
    encoding: "protobuf",
    run: (e) => {
      const a = agent(e, { name: "weather-agent", startMs: 0, endMs: 1000, conversationId: CONV });
      const c = chat(e, { parent: a, startMs: 50, endMs: 300, conversationId: CONV, system: SYSTEM, input: [USER_Q], output: [ASSISTANT_FINAL], responseId: "resp_0007" });
      e.log({
        eventName: "gen_ai.evaluation.result",
        atMs: 350,
        severity: SeverityNumber.INFO,
        span: c,
        attrs: {
          "gen_ai.evaluation.name": "relevance",
          "gen_ai.evaluation.score.value": 0.9,
          "gen_ai.evaluation.score.label": "pass",
          "gen_ai.evaluation.explanation": "The answer addresses the question and names the city.",
          "gen_ai.response.id": "resp_0007",
          "gen_ai.conversation.id": CONV,
        },
      });
    },
  },
  {
    name: "tool-definitions-and-compaction",
    description: "A chat span with gen_ai.tool.definitions (relocated into the payload beside the messages) and gen_ai.conversation.compacted = true, with a compaction part in the input (preserved, not interpreted).",
    encoding: "protobuf",
    run: (e) => {
      const a = agent(e, { name: "weather-agent", startMs: 0, endMs: 1000, conversationId: CONV });
      chat(e, {
        parent: a,
        startMs: 50,
        endMs: 900,
        conversationId: CONV,
        system: SYSTEM,
        input: [{ role: "user", parts: [{ type: "compaction", content: "Earlier the user asked about Paris and Lyon." }] }, USER_Q],
        output: [ASSISTANT_TOOL_CALL],
        finishReasons: ["tool_call"],
        extra: {
          "gen_ai.conversation.compacted": true,
          "gen_ai.tool.definitions": e.json("gen-ai-tool-definitions", [
            {
              type: "function",
              name: "get_weather",
              description: "Current conditions for a city.",
              parameters: { type: "object", properties: { location: { type: "string" } }, required: ["location"] },
            },
            { type: "spec-emitter.web_search", name: "web_search" },
          ]),
        },
      });
    },
  },
];
