// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

import { spawn } from "node:child_process";
import { loadConfig } from "../config.js";

export async function open(sessionId: string | undefined, jsonOutput: boolean): Promise<void> {
  const config = loadConfig();
  const base = `http://127.0.0.1:${config.apiPort}`;
  const url = sessionId !== undefined ? `${base}/s/${encodeURIComponent(sessionId)}` : base;
  if (jsonOutput) {
    console.log(JSON.stringify({ url }));
  } else {
    console.log(url);
  }
  const opener =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  const child = spawn(opener, [url], { stdio: "ignore", detached: true });
  child.on("error", () => {
    // Browser launch is best-effort; the URL is already printed.
  });
  child.unref();
}
