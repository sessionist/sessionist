// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// The reader starts with every client session and the sink runs on; when they are different versions the
// reader says so in its instructions, and only then.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { compareVersions } from "../src/cli/version.js";
import { MCP_INSTRUCTIONS, versionNotice } from "../src/mcp/instructions.js";
import { createMcpServer } from "../src/mcp/server.js";
import { openDb } from "../src/store/db.js";

const UPDATE = "npx -y sessionist update";

describe("compareVersions", () => {
  it("orders numerically, not lexically", () => {
    expect(compareVersions("0.1.2", "0.1.10")).toBe(-1);
    expect(compareVersions("1.0.0", "0.9.9")).toBe(1);
    expect(compareVersions("0.1.1", "0.1.1")).toBe(0);
    expect(compareVersions("0.1.1", "0.1.1-beta.1")).toBe(0);
    expect(compareVersions("v0.2.0", "0.1.9")).toBe(1);
  });
});

describe("versionNotice", () => {
  it("says nothing when the sink is down or the versions agree", () => {
    expect(versionNotice("0.1.2", undefined, UPDATE)).toBeUndefined();
    expect(versionNotice("0.1.2", "0.1.2", UPDATE)).toBeUndefined();
  });

  it("names the update command when the sink is the older one", () => {
    const notice = versionNotice("0.1.2", "0.1.1", UPDATE)!;
    expect(notice).toContain("0.1.2");
    expect(notice).toContain("0.1.1");
    expect(notice).toContain(`\`${UPDATE}\``);
    expect(notice).toContain("once");
  });

  it("points at a new client session when the reader is the older one", () => {
    const notice = versionNotice("0.1.1", "0.1.2", UPDATE)!;
    expect(notice).toContain("new coding-agent session");
    expect(notice).not.toContain(UPDATE);
  });

  it("still speaks when the strings differ but do not order", () => {
    expect(versionNotice("unknown", "0.1.2", UPDATE)).toContain("0.1.2");
  });
});

describe("the notice on the wire", () => {
  it("is appended to the instructions the client receives, and absent when there is none", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sessionist-notice-"));
    try {
      const db = openDb(dir);
      const connect = async (notice?: string): Promise<string | undefined> => {
        const server = createMcpServer({ source: db, dataDir: dir, version: "0.1.2", ...(notice !== undefined ? { notice } : {}) });
        const client = new Client({ name: "t", version: "0" });
        const [ct, st] = InMemoryTransport.createLinkedPair();
        await Promise.all([server.connect(st), client.connect(ct)]);
        const text = client.getInstructions();
        await client.close();
        return text;
      };
      expect(await connect()).toBe(MCP_INSTRUCTIONS);
      const notice = versionNotice("0.1.2", "0.1.1", UPDATE)!;
      const withNotice = await connect(notice);
      expect(withNotice!.startsWith(MCP_INSTRUCTIONS)).toBe(true);
      expect(withNotice!.endsWith(notice)).toBe(true);
      db.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
