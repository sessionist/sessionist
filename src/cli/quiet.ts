// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// Drop Node's experimental-feature notice for its built-in SQLite and print every other warning as Node
// would; imported before any module that loads node:sqlite, because stdout of `sessionist mcp` is the protocol
// and stderr is the client's log.

const isSqliteNotice = (warning: Error): boolean =>
  warning.name === "ExperimentalWarning" && /sqlite/i.test(warning.message);

process.removeAllListeners("warning");
process.on("warning", (warning: Error) => {
  if (isSqliteNotice(warning)) return;
  const detail = warning.stack ?? `${warning.name}: ${warning.message}`;
  process.stderr.write(`(node:${String(process.pid)}) ${detail}\n`);
});
