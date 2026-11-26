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
/** What the stubbed sink probe answers; tests set it. */
let sinkStub: { version: string; uptimeMs: number; pid?: number } | undefined;

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

  const server = createMcpServer({
    source: db,
    dataDir: dir,
    version: "test",
    info: {
      otlpPort: 4318,
      apiPort: 4319,
      sink: async () => sinkStub,
      service: () => ({ supported: false, platform: "test" as NodeJS.Platform, installed: false }),
      updateCommand: "npx sessionist update",
    },
  });
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
  it("exposes exactly the seven read-only tools", async () => {
    const tools = (await client.listTools()).tools.map((t) => t.name).sort();
    expect(tools).toEqual([
      "export_session",
      "get_event_payload",
      "get_session",
      "list_sessions",
      "reads_summary",
      "search_sessions",
      "sessionist_info",
    ]);
  });

  it("sessionist_info describes the install without inventing a sink that is not there", async () => {
    sinkStub = undefined;
    const info = toolJson(await client.callTool({ name: "sessionist_info", arguments: {} }));
    expect(info["reader"]).toEqual({ version: "test", pid: process.pid, node: process.version, client: "test-agent 0.0.0" });
    expect(info["sink"]).toEqual({ listening: false, otlpUrl: "http://127.0.0.1:4318", apiUrl: "http://127.0.0.1:4319" });
    const store = info["store"] as Record<string, unknown>;
    expect(store["dataDir"]).toBe(dir);
    expect(store["schemaVersion"]).toBe(4);
    expect(store["sessions"]).toBe(1);
    expect(store["events"]).toBe(3);
    expect(store["running"]).toBe(0);
    expect(store["newestStartedAt"]).toBe("2026-01-01T00:00:00.000000000Z");
    expect(store["dbBytes"]).toBeGreaterThan(0);
    expect(info["service"]).toEqual({ supported: false, platform: "test", installed: false });
    expect(info["versionNote"]).toBeUndefined();
  });

  it("sessionist_info names the sink and carries the version note only when the versions differ", async () => {
    sinkStub = { version: "test", uptimeMs: 5000, pid: 4242 };
    const same = toolJson(await client.callTool({ name: "sessionist_info", arguments: {} }));
    expect(same["sink"]).toMatchObject({ listening: true, version: "test", pid: 4242, uptimeMs: 5000 });
    expect(same["versionNote"]).toBeUndefined();

    sinkStub = { version: "9.9.9", uptimeMs: 5000 };
    const differ = toolJson(await client.callTool({ name: "sessionist_info", arguments: {} }));
    expect(differ["sink"]).not.toHaveProperty("pid");
    expect(differ["versionNote"]).toMatch(/^Version note: .*9\.9\.9/);
  });

  it("answers 'exact prompt at the errored step' in three tool calls", async () => {
    // Call 1: which session errored?
    const list = toolJson(await client.callTool({ name: "list_sessions", arguments: { status: "error" } }));
    const sessions = list["sessions"] as { id: string }[];
    expect(sessions).toHaveLength(1);
    expect(list["store"]).toEqual({ sessions: 1, newestStartedAt: "2026-01-01T00:00:00.000000000Z" });
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

  it("tells an empty page under a bound apart from an empty store", async () => {
    const windowed = toolJson(
      await client.callTool({ name: "list_sessions", arguments: { since: "2030-01-01T00:00:00Z" } }),
    );
    expect(windowed["sessions"]).toEqual([]);
    expect((windowed["store"] as { sessions: number }).sessions).toBe(1);

    const searched = toolJson(await client.callTool({ name: "list_sessions", arguments: { text: "zzz-never-sent" } }));
    expect(searched["sessions"]).toEqual([]);
    expect((searched["store"] as { sessions: number }).sessions).toBe(1);
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

  it("sessionist_info lists this reader among recent readers, alive and marked as itself", async () => {
    // Earlier tests in this file have read through this server, so its PID is on file.
    const info = toolJson(await client.callTool({ name: "sessionist_info", arguments: {} }));
    const readers = info["readers"] as Record<string, unknown>[];
    const mine = readers.find((r) => r["pid"] === process.pid);
    expect(mine).toMatchObject({ client: "test-agent 0.0.0", alive: true, thisReader: true });
    expect(mine!["calls"]).toBeGreaterThan(0);
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
