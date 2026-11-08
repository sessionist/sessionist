// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// The shipped coding-agent skill is installable and idempotent, and the reading order lives in
// the MCP server where a client gets it on connect without installing anything.

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../src/mcp/server.js";
import { MCP_INSTRUCTIONS } from "../src/mcp/instructions.js";
import { openDb, type Db } from "../src/store/db.js";
import { SKILL_NAME, findSkillFile, installSkill, stripFrontmatter } from "../src/cli/skill.js";

describe("the shipped skill", () => {
  it("ships with the package and is found at runtime", () => {
    const path = findSkillFile();
    expect(path).toBeDefined();
    expect(readFileSync(path!, "utf8")).not.toBe("");
  });

  it("leads with frontmatter so a coding agent can read its name and trigger", () => {
    const content = readFileSync(findSkillFile()!, "utf8");
    // The frontmatter must be the first bytes: a license header above it would
    // stop Claude Code recognizing the skill at all.
    expect(content.startsWith("---\n")).toBe(true);
    const frontmatter = content.slice(4, content.indexOf("\n---\n", 4));
    expect(frontmatter).toContain(`name: ${SKILL_NAME}`);
    expect(frontmatter).toContain("description:");
  });

  it("carries the license header below the frontmatter", () => {
    const content = readFileSync(findSkillFile()!, "utf8");
    expect(content).toContain("SPDX-License-Identifier: MIT");
  });

  it("states the two rules that make it ours, not an SDK installer", () => {
    const body = readFileSync(findSkillFile()!, "utf8");
    expect(body).toContain("Never install a Sessionist package");
    expect(body).toMatch(/Never install or upgrade an OpenTelemetry package/);
  });

  it("strips frontmatter for agents that have no use for it", () => {
    const stripped = stripFrontmatter(readFileSync(findSkillFile()!, "utf8"));
    expect(stripped.startsWith("---")).toBe(false);
    expect(stripped).toContain("SPDX-License-Identifier");
  });
});

describe("skill install", () => {
  let home: string;

  beforeAll(() => {
    home = mkdtempSync(join(tmpdir(), "sessionist-skill-"));
  });

  afterAll(() => {
    rmSync(home, { recursive: true, force: true });
  });

  it("writes the skill into a skills root", () => {
    const root = join(home, "fresh", ".claude", "skills");
    const result = installSkill(root);
    expect(result.changed).toBe(true);
    expect(result.path).toBe(join(root, SKILL_NAME, "SKILL.md"));
    expect(readFileSync(result.path, "utf8")).toBe(readFileSync(findSkillFile()!, "utf8"));
  });

  it("is idempotent: a second install reports no change", () => {
    const root = join(home, "twice", ".claude", "skills");
    expect(installSkill(root).changed).toBe(true);
    const second = installSkill(root);
    expect(second.changed).toBe(false);
  });

  it("overwrites an edited copy so a stale skill cannot linger", () => {
    const root = join(home, "stale", ".claude", "skills");
    const first = installSkill(root);
    writeFileSync(first.path, "---\nname: sessionist-connect\n---\nstale\n");
    const again = installSkill(root);
    expect(again.changed).toBe(true);
    expect(readFileSync(again.path, "utf8")).toContain("Never install a Sessionist package");
  });
});

describe("MCP reading guidance", () => {
  let dir: string;
  let db: Db;
  let client: Client;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "sessionist-instr-"));
    db = openDb(dir);
    const server = createMcpServer(db, dir, "0.0.0-test");
    client = new Client({ name: "test", version: "0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  });

  afterAll(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("reaches the client on connect, so reading needs no skill installed", () => {
    expect(client.getInstructions()).toBe(MCP_INSTRUCTIONS);
  });

  it("names the reading order and the never-invent rule", () => {
    const instructions = client.getInstructions()!;
    for (const tool of ["list_sessions", "get_session", "get_event_payload", "search_sessions", "export_session", "reads_summary"]) {
      expect(instructions).toContain(tool);
    }
    expect(instructions).toMatch(/never invent|Never invent/);
    expect(instructions).toContain("read the session before re-reading the source");
  });

  it("chains every tool description to a neighbour, so the order survives a client that drops instructions", async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);
    expect(names.sort()).toEqual(
      ["export_session", "get_event_payload", "get_session", "list_sessions", "reads_summary", "search_sessions"].sort(),
    );
    for (const tool of tools) {
      const others = names.filter((n) => n !== tool.name);
      const description = tool.description ?? "";
      expect(
        others.some((other) => description.includes(other)),
        `${tool.name} description names no other tool`,
      ).toBe(true);
    }
  });
});
