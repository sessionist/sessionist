// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// Each spec fixture exercises one feature of the GenAI semantic conventions
// (tools/spec-emitter/scenarios.ts); these tests state what the reader must make of it.

import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runPipeline, type PipelineResult } from "./helpers/replay.js";

const SPEC_DIR = join(import.meta.dirname, "..", "fixtures", "spec");

type Ev = PipelineResult["timelines"][string][number];

function events(r: PipelineResult): Ev[] {
  return Object.values(r.timelines).flat();
}

function byTs(r: PipelineResult): Ev[] {
  return events(r).sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : a.seq - b.seq));
}

function types(r: PipelineResult): string[] {
  return byTs(r).map((e) => e.type);
}

function rule(r: PipelineResult): unknown {
  const meta = r.sessions[0]!.meta["sessionist"] as Record<string, unknown>;
  return meta["grouping_rule"];
}

function load(name: string): PipelineResult {
  return runPipeline(join(SPEC_DIR, name));
}

function inputMessages(e: Ev): unknown[] {
  const input = (e.payload as { input?: unknown } | undefined)?.input;
  if (Array.isArray(input)) return input;
  const shaped = input as { messages?: unknown[] } | undefined;
  return shaped?.messages ?? [];
}

describe("agent-tool-loop", () => {
  const r = load("agent-tool-loop");
  it("is one session grouped by gen_ai.conversation.id", () => {
    expect(r.sessions).toHaveLength(1);
    expect(rule(r)).toBe("conversation_id");
    expect(r.sessions[0]!.service).toBe("spec-emitter");
  });
  it("reads the bracket, two model calls, and the tool call in time order", () => {
    expect(types(r)).toEqual(["agent_start", "llm_call", "tool_call", "llm_call", "agent_end"]);
  });
  it("relocates message content into payloads with the source recorded", () => {
    const calls = byTs(r).filter((e) => e.type === "llm_call");
    for (const c of calls) {
      expect(c.attrs["sessionist.payload_source"]).toBe("gen_ai.input.messages");
      expect(c.attrs["gen_ai.input.messages"]).toBeUndefined(); // relocated, not duplicated
      const input = (c.payload as { input: { system_instructions: unknown; messages: unknown[] } }).input;
      expect(Array.isArray(input.system_instructions)).toBe(true);
      expect(input.messages.length).toBeGreaterThan(0);
    }
    expect(inputMessages(calls[1]!)).toHaveLength(3); // user, assistant tool_call, tool response
  });
  it("links the tool call to the model's tool_call part by id", () => {
    const tool = byTs(r).find((e) => e.type === "tool_call")!;
    expect(tool.name).toBe("get_weather");
    expect(tool.attrs["gen_ai.tool.call.id"]).toBe("call_0001");
    expect(tool.attrs["sessionist.payload_source"]).toBe("gen_ai.tool.call");
    const firstCall = byTs(r).find((e) => e.type === "llm_call")!;
    const output = (firstCall.payload as { output: { parts: { id?: string }[] }[] }).output;
    expect(output[0]!.parts[0]!.id).toBe("call_0001");
  });
  it("names the bracket from gen_ai.agent.name and keeps usage attributes", () => {
    const start = byTs(r)[0]!;
    expect(start.name).toBe("weather-agent");
    const call = byTs(r).find((e) => e.type === "llm_call")!;
    expect(call.attrs["gen_ai.usage.input_tokens"]).toBe(42);
    expect(call.attrs["gen_ai.response.finish_reasons"]).toEqual(["tool_call"]);
  });
});

describe("content-as-log-record", () => {
  const r = load("content-as-log-record");
  it("keeps metadata-only spans as model calls without payloads", () => {
    const calls = events(r).filter((e) => e.type === "llm_call");
    expect(calls).toHaveLength(2);
    for (const c of calls) expect(c.hasPayload).toBe(false);
  });
  it("relocates the operation.details log record's content into a payload on the logs signal", () => {
    const details = events(r).filter((e) => e.name === "gen_ai.client.inference.operation.details");
    expect(details).toHaveLength(2);
    for (const d of details) {
      expect(d.attrs["sessionist.signal"]).toBe("logs");
      expect(d.attrs["sessionist.payload_source"]).toBe("log_attributes");
      expect(d.attrs["gen_ai.input.messages"]).toBeUndefined();
      expect(d.hasPayload).toBe(true);
    }
    expect(r.sessions).toHaveLength(1); // the record's gen_ai.conversation.id groups it with the spans
  });
});

describe("error-path", () => {
  const r = load("error-path");
  it("carries error status on the tool call, the model call, and the bracket end", () => {
    const tool = events(r).find((e) => e.type === "tool_call")!;
    expect(tool.status).toBe("error");
    expect(tool.attrs["error.type"]).toBe("TimeoutError");
    expect(tool.attrs["otel.status_message"]).toBe("upstream timeout");
    const end = events(r).find((e) => e.type === "agent_end")!;
    expect(end.status).toBe("error");
    expect(r.sessions[0]!.status).toBe("error");
  });
  it("surfaces the exception span event as its own error event", () => {
    const err = events(r).find((e) => e.type === "error")!;
    expect(err.name).toBe("RateLimitError");
    expect(err.attrs["exception.message"]).toBe("429 Too Many Requests");
    expect(err.attrs["sessionist.derived"]).toBe("span_event");
  });
});

describe("no-conversation-id", () => {
  const r = load("no-conversation-id");
  it("falls to the same-service time window", () => {
    expect(["time_window", "new_session"]).toContain(rule(r));
    expect(r.sessions).toHaveLength(1);
    expect(events(r).filter((e) => e.type === "agent_start")).toHaveLength(2);
  });
});

describe("explicit-session-id", () => {
  const r = load("explicit-session-id");
  it("groups by session.id when there is no conversation id", () => {
    expect(rule(r)).toBe("session_id");
    const meta = r.sessions[0]!.meta["sessionist"] as Record<string, unknown>;
    expect(meta["group_key"]).toBe("sess:app-session-0042");
  });
});

describe("subagent", () => {
  const r = load("subagent");
  it("nests the child agent under the outer one by parent span id", () => {
    const starts = byTs(r).filter((e) => e.type === "agent_start");
    expect(starts.map((e) => e.name)).toEqual(["planner", "weather-agent"]);
    const outer = starts[0]!;
    const inner = starts[1]!;
    expect(inner.attrs["otel.parent_span_id"]).toBe(outer.provenance.spanId);
    const innerCalls = events(r).filter((e) => e.type === "llm_call" && e.attrs["otel.parent_span_id"] === inner.provenance.spanId);
    expect(innerCalls).toHaveLength(2);
  });
});

describe("other-operations", () => {
  const r = load("other-operations");
  it("maps every inference operation to a model call", () => {
    const calls = events(r).filter((e) => e.type === "llm_call");
    expect(calls.map((e) => e.attrs["gen_ai.operation.name"]).sort()).toEqual(["embeddings", "generate_content", "text_completion"]);
  });
  it("keeps create_agent, plan, and an unknown operation as plain spans with nothing guessed", () => {
    const plain = events(r).filter((e) => e.type === "span");
    expect(plain.map((e) => e.attrs["gen_ai.operation.name"]).sort()).toEqual(["create_agent", "plan", "summon_dragon"]);
    expect(plain.find((e) => e.name === "summon_dragon")!.hasPayload).toBe(false);
  });
});

describe("passthrough-mixed", () => {
  const r = load("passthrough-mixed");
  it("keeps the HTTP and database spans verbatim, nested under the tool call", () => {
    const tool = events(r).find((e) => e.type === "tool_call")!;
    const http = events(r).find((e) => e.name === "GET")!;
    const db = events(r).find((e) => e.name === "SELECT weather_cache")!;
    expect(http.type).toBe("span");
    expect(http.provenance.dialect).toBe("passthrough");
    expect(http.attrs["url.full"]).toBe("https://weather.example.test/v1/current?city=Paris");
    expect(http.attrs["otel.parent_span_id"]).toBe(tool.provenance.spanId);
    expect(db.attrs["db.query.text"]).toBe("SELECT payload FROM weather_cache WHERE city = ?");
    expect(r.sessions).toHaveLength(1);
  });
});

describe("large-payload", () => {
  const r = load("large-payload");
  it("round-trips a payload over the blob threshold intact", () => {
    const call = events(r).find((e) => e.type === "llm_call")!;
    const text = (inputMessages(call)[0] as { parts: { content: string }[] }).parts[0]!.content;
    expect(text.length).toBeGreaterThan(32 * 1024);
    expect(text.endsWith("afternoon. ")).toBe(true);
  });
});

describe("content-by-reference", () => {
  const r = load("content-by-reference");
  it("records the references as the payload source and fetches nothing", () => {
    const call = events(r).find((e) => e.type === "llm_call")!;
    expect(call.hasPayload).toBe(false);
    expect(call.attrs["sessionist.payload_source"]).toBe("reference");
    expect(call.attrs["sessionist.payload_refs"]).toEqual([
      "gen_ai.input.messages_ref",
      "gen_ai.output.messages_ref",
      "gen_ai.system_instructions_ref",
    ]);
    expect(call.attrs["gen_ai.input.messages_ref"]).toBe("s3://spec-emitter/run-0001/chat-0001/input.json");
  });
});

describe("workflow-and-plan", () => {
  const r = load("workflow-and-plan");
  it("renders the workflow as a bracket named from gen_ai.workflow.name, the plan as a plain span", () => {
    const starts = byTs(r).filter((e) => e.type === "agent_start");
    expect(starts.map((e) => e.name)).toEqual(["daily-report", "weather-agent"]);
    expect(starts[0]!.attrs["gen_ai.operation.name"]).toBe("invoke_workflow");
    const plan = events(r).find((e) => e.name === "plan daily-report")!;
    expect(plan.type).toBe("span");
    expect(plan.attrs["otel.parent_span_id"]).toBe(starts[0]!.provenance.spanId);
  });
});

describe("retrieval", () => {
  const r = load("retrieval");
  it("emits a retrieval event with the query and documents as payload", () => {
    const ret = events(r).find((e) => e.type === "retrieval")!;
    expect(ret.name).toBe("docs-index");
    expect(ret.attrs["sessionist.payload_source"]).toBe("gen_ai.retrieval");
    expect(ret.attrs["gen_ai.retrieval.top_k"]).toBe(3);
    const p = ret.payload as { input: string; output: { id: string }[] };
    expect(p.input).toBe("rain policy");
    expect(p.output.map((d) => d.id)).toEqual(["doc_123", "doc_456", "doc_789"]);
  });
});

describe("mcp-tool-call", () => {
  const r = load("mcp-tool-call");
  it("renders both MCP spans as tool calls, server nested under client, never deduplicated", () => {
    const tools = byTs(r).filter((e) => e.type === "tool_call");
    expect(tools).toHaveLength(2);
    expect(tools.map((e) => e.attrs["otel.span.kind"])).toEqual([3, 2]); // CLIENT, SERVER
    expect(tools[1]!.attrs["otel.parent_span_id"]).toBe(tools[0]!.provenance.spanId);
    for (const t of tools) {
      expect(t.name).toBe("get-weather");
      expect(t.attrs["mcp.method.name"]).toBe("tools/call");
      expect(t.attrs["sessionist.payload_source"]).toBe("gen_ai.tool.call");
      expect((t.payload as { output: { temperature_range: { high: number } } }).output.temperature_range.high).toBe(75);
    }
  });
});

describe("mcp-session", () => {
  const r = load("mcp-session");
  it("keeps non-tool MCP operations as passthrough spans under the agent", () => {
    const start = events(r).find((e) => e.type === "agent_start")!;
    const mcp = events(r).filter((e) => typeof e.attrs["mcp.method.name"] === "string");
    expect(mcp.map((e) => e.attrs["mcp.method.name"]).sort()).toEqual(["initialize", "initialize", "resources/read", "tools/list", "tools/list"]);
    for (const m of mcp) {
      expect(m.type).toBe("span");
      expect(m.provenance.dialect).toBe("passthrough");
    }
    const clients = mcp.filter((e) => e.attrs["otel.span.kind"] === 3);
    for (const c of clients) expect(c.attrs["otel.parent_span_id"]).toBe(start.provenance.spanId);
    expect(r.sessions).toHaveLength(1);
  });
});

describe("agent-transfer", () => {
  const r = load("agent-transfer");
  it("reads the transfer tool call as a handoff named by the target, then the nested agent", () => {
    const handoff = events(r).find((e) => e.type === "handoff")!;
    expect(handoff.name).toBe("weather_agent");
    expect(handoff.attrs["gen_ai.tool.name"]).toBe("transfer_to_weather_agent");
    expect(handoff.attrs["gen_ai.transfer.mode"]).toBe("pass_control");
    const starts = byTs(r).filter((e) => e.type === "agent_start");
    expect(starts.map((e) => e.name)).toEqual(["triage", "weather_agent"]);
    expect(events(r).filter((e) => e.type === "tool_call")).toHaveLength(1); // the real tool inside the target
  });
});

describe("skills", () => {
  const r = load("skills");
  it("renders skill tool calls as tool calls with gen_ai.skill.name preserved", () => {
    const tools = byTs(r).filter((e) => e.type === "tool_call");
    expect(tools.map((e) => e.name)).toEqual(["load_skill", "read_skill_resource"]);
    for (const t of tools) expect(t.attrs["gen_ai.skill.name"]).toBe("pdf-reader");
  });
});

describe("fetch-response", () => {
  const r = load("fetch-response");
  it("reads fetch_response as a model call with output only", () => {
    const fetched = events(r).find((e) => e.attrs["gen_ai.operation.name"] === "fetch_response")!;
    expect(fetched.type).toBe("llm_call");
    expect(fetched.name).toBe("spec-model-2026-01"); // no request model; falls to the response model
    expect(fetched.attrs["gen_ai.request.previous_response.id"]).toBe("resp_0000");
    const p = fetched.payload as { input?: unknown; output: unknown[] };
    expect(p.input).toBeUndefined();
    expect(p.output).toHaveLength(1);
  });
});

describe("memory-operations", () => {
  const r = load("memory-operations");
  it("keeps memory operations as plain spans with their attributes", () => {
    const mem = events(r).filter((e) => typeof e.attrs["gen_ai.memory.store.id"] === "string");
    expect(mem.map((e) => e.attrs["gen_ai.operation.name"])).toEqual(["create_memory_store", "upsert_memory", "search_memory", "delete_memory"]);
    for (const m of mem) expect(m.type).toBe("span");
    expect(events(r).find((e) => e.attrs["gen_ai.operation.name"] === "upsert_memory")!.attrs["gen_ai.memory.records"]).toBeTypeOf("string");
  });
});

describe("exception-log-event", () => {
  const r = load("exception-log-event");
  it("turns the operation.exception log record into an error event", () => {
    const errs = events(r).filter((e) => e.type === "error");
    expect(errs).toHaveLength(1);
    const err = errs[0]!;
    expect(err.name).toBe("RateLimitError");
    expect(err.status).toBe("error");
    expect(err.attrs["sessionist.signal"]).toBe("logs");
    expect(err.attrs["sessionist.derived"]).toBe("log_event");
    expect(err.attrs["exception.stacktrace"]).toContain("RateLimitError");
    expect(r.sessions).toHaveLength(1);
  });
});

describe("evaluation-event", () => {
  const r = load("evaluation-event");
  it("preserves the evaluation result as a plain event and adopts no verdict", () => {
    const ev = events(r).find((e) => e.name === "gen_ai.evaluation.result")!;
    expect(ev.type).toBe("span");
    expect(ev.status).toBe("unset");
    expect(ev.attrs["gen_ai.evaluation.score.value"]).toBe(0.9);
    expect(ev.attrs["gen_ai.evaluation.score.label"]).toBe("pass");
    expect(r.sessions[0]!.status).toBe("ok"); // the session's status is mechanical, not the judge's
  });
});

describe("tool-definitions-and-compaction", () => {
  const r = load("tool-definitions-and-compaction");
  it("relocates tool definitions into the payload and preserves the compaction flag", () => {
    const call = events(r).find((e) => e.type === "llm_call")!;
    expect(call.attrs["gen_ai.tool.definitions"]).toBeUndefined();
    expect(call.attrs["gen_ai.conversation.compacted"]).toBe(true);
    const input = (call.payload as { input: { tool_definitions: { name: string }[]; messages: { parts: { type: string }[] }[] } }).input;
    expect(input.tool_definitions.map((t) => t.name)).toEqual(["get_weather", "web_search"]);
    expect(input.messages[0]!.parts[0]!.type).toBe("compaction");
  });
});

describe("encodings", () => {
  it("protobuf and JSON exports of the same run read identically", () => {
    const pb = load("agent-tool-loop");
    const json = load("agent-tool-loop-json");
    expect(json.sessions).toEqual(pb.sessions);
    expect(json.timelines).toEqual(pb.timelines);
  });
});
