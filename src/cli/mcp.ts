// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// `sessionist mcp`: stdio transport for the MCP server; stdout belongs to the protocol, so nothing else may write to it.

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "../config.js";
import { openDbHandle } from "../store/db.js";
import { createMcpServer } from "../mcp/server.js";
import { versionNotice } from "../mcp/instructions.js";
import { skillInstallCommand } from "../setup/apply.js";
import { serviceStatus } from "../service/install.js";
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
  const updateCommand = `${skillInstallCommand()} update`;
  const sink = await sinkHealth(config.apiPort);
  const notice = versionNotice(version, sink?.version, updateCommand);
  const server = createMcpServer({
    source: () => handle.current(),
    dataDir: config.dataDir,
    version,
    ...(notice !== undefined ? { notice } : {}),
    info: {
      otlpPort: config.otlpPort,
      apiPort: config.apiPort,
      sink: () => sinkHealth(config.apiPort),
      service: () => serviceStatus(),
      updateCommand,
    },
  });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // The client owns this process: when its pipe closes, or it is gone and we have been reparented, exit,
  // so no orphan keeps serving the store after the session that started it.
  process.stdin.once("end", () => process.exit(0));
  const parent = process.ppid;
  setInterval(() => {
    if (process.ppid !== parent) process.exit(0);
  }, PARENT_CHECK_MS).unref();
}

const PARENT_CHECK_MS = 5_000;
