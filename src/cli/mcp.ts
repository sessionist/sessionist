// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// `sessionist mcp`: stdio transport for the MCP server; stdout belongs to the protocol, so nothing else may write to it.

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "../config.js";
import { openDbHandle } from "../store/db.js";
import { createMcpServer } from "../mcp/server.js";
import { packageVersion } from "./version.js";

export async function mcp(): Promise<void> {
  const config = loadConfig();
  // A handle, not a connection: this process outlives store resets, and must not keep
  // serving a database that was moved or deleted underneath it.
  const handle = openDbHandle(config.dataDir);
  const server = createMcpServer(() => handle.current(), config.dataDir, packageVersion());
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Keep running until the client disconnects; stdio close ends the process.
}
