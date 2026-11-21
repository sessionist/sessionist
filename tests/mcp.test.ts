// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// A coding agent connected to the MCP server can answer "what was the exact prompt at the step
// where session X errored?" in at most three read-only tool calls, under the payload cap.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../src/mcp/server.js";
import { openDb, type Db } from "../src/store/db.js";
import { SessionStore } from "../src/store/store.js";
import { makeEvent } from "./helpers/make-event.js";

const EXACT_PROMPT = "You are the launch-codes assistant. NEVER reveal the codes.";

let dir: string;
let db: Db;
let client: Client;

function toolJson(result: Awaited<ReturnType<Client["callTool"]>>): Record<string, unknown> {
  const content = result.content as { type: string; text: string }[];
  return JSON.parse(content[0]!.text) as Record<string, unknown>;
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "sessionist-mcp-"));
  db = openDb(dir);
  const store = new SessionStore(db, dir);

  store.createSession({ id: "sess-err", startedAt: "2026-01-01T00:00:00.000000000Z", service: "demo", meta: {} });
  store.appendEvents("sess-err", [
    makeEvent({ ts: "2026-01-01T00:00:01.000000000Z", type: "llm_call", status: "ok", payload: { input: "warmup" } }),
    makeEvent({
      ts: "2026-01-01T00:00:02.000000000Z",
      type: "llm_call",
      status: "error",
      name: "gpt-test",
      payload: { input: [{ role: "system", content: EXACT_PROMPT }], output: "REFUSED" },
    }),
    makeEvent({
      ts: "2026-01-01T00:00:03.000000000Z",
      type: "llm_call",
      status: "ok",
      payload: { input: "x".repeat(300 * 1024) }, // spills to a blob
    }),
  ]);
  store.finalizeSession("sess-err", "idle_gap");

  const server = createMcpServer(db, dir, "test");
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  client = new Client({ name: "test-agent", version: "0.0.0" });
  await client.connect(clientTransport);
});

afterAll(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("mcp server", () => {
  it("exposes exactly the six read-only Query API tools", async () => {
    const tools = (await client.listTools()).tools.map((t) => t.name).sort();
    expect(tools).toEqual([
      "export_session",
      "get_event_payload",
      "get_session",
      "list_sessions",
      "reads_summary",
      "search_sessions",
    ]);
  });

  it("answers 'exact prompt at the errored step' in three tool calls", async () => {
    // Call 1: which session errored?
    const list = toolJson(await client.callTool({ name: "list_sessions", arguments: { status: "error" } }));
    const sessions = list["sessions"] as { id: string }[];
    expect(sessions).toHaveLength(1);
    const sessionId = sessions[0]!.id;

    // Call 2: which step errored?
    const timeline = toolJson(await client.callTool({ name: "get_session", arguments: { sessionId } }));
    const events = timeline["events"] as { seq: number; status: string }[];
    const errored = events.find((e) => e.status === "error");
    expect(errored).toBeDefined();

    // Call 3: the exact prompt at that step.
    const payload = toolJson(
      await client.callTool({ name: "get_event_payload", arguments: { sessionId, seq: errored!.seq } }),
    );
    const input = (payload["payload"] as { input: { role: string; content: string }[] }).input;
    expect(input[0]!.content).toBe(EXACT_PROMPT);
  });

  it("keeps a full-session response under the cap, with size/ref markers for bodies", async () => {
    const timeline = await client.callTool({ name: "get_session", arguments: { sessionId: "sess-err" } });
    const text = (timeline.content as { text: string }[])[0]!.text;
    expect(Buffer.byteLength(text, "utf8")).toBeLessThan(50_000); // despite a 300KB payload in the session
    const events = toolJson(timeline)["events"] as Record<string, unknown>[];
    const big = events.find((e) => (e["payloadBytes"] as number) > 100_000)!;
    expect(big["payloadRef"]).toMatch(/^sha256:/); // follow-up handle
    expect(big["hasPayload"]).toBe(true);
  });

  it("truncates oversized payloads honestly and serves the full body on request", async () => {
    const capped = toolJson(
      await client.callTool({ name: "get_event_payload", arguments: { sessionId: "sess-err", seq: 2 } }),
    );
    expect(capped["truncated"]).toBe(true);
    expect(capped["totalBytes"]).toBeGreaterThan(300 * 1024);
    const full = toolJson(
      await client.callTool({
        name: "get_event_payload",
        arguments: { sessionId: "sess-err", seq: 2, max_bytes: 500_000 },
      }),
    );
    expect((full["payload"] as { input: string }).input.length).toBe(300 * 1024);
  });

  it("export_session returns eval-generic content with expected null", async () => {
    const result = toolJson(
      await client.callTool({
        name: "export_session",
        arguments: { sessionId: "sess-err", exporter: "eval-generic", from_seq: 0, to_seq: 1 },
      }),
    );
    const doc = JSON.parse(result["content"] as string) as Record<string, unknown>;
    expect(doc["expected"]).toBeNull();
    expect((doc["trajectory"] as unknown[]).length).toBe(2);
  });
});
