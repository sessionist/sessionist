// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// `sessionist mcp`: stdio transport for the MCP server; stdout belongs to the protocol, so nothing else may write to it.

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "../config.js";
import { openDbHandle } from "../store/db.js";
import { createMcpServer } from "../mcp/server.js";
import { versionNotice } from "../mcp/instructions.js";
import { skillInstallCommand } from "../setup/apply.js";
import { sinkHealth } from "./service.js";
import { packageVersion } from "./version.js";

export async function mcp(): Promise<void> {
  const config = loadConfig();
  const version = packageVersion();
  // A handle, not a connection: this process outlives store resets, and must not keep
  // serving a database that was moved or deleted underneath it.
  const handle = openDbHandle(config.dataDir);
  // The sink is the long-running process and the one that goes stale; this process starts with every
  // client session, so it is the one that can say so.
  const sink = await sinkHealth(config.apiPort);
  const notice = versionNotice(version, sink?.version, `${skillInstallCommand()} update`);
  const server = createMcpServer(() => handle.current(), config.dataDir, version, notice);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Keep running until the client disconnects; stdio close ends the process.
}
