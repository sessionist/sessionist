// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// Capture sink standing in for the receiver while the emitter runs: saves every request body
// verbatim as NNNN.<signal>.<pb|json> beside NNNN.headers.json (layout in fixtures/README.md).

import { createServer, type Server } from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface Capture {
  port: number;
  count(): number;
  close(): Promise<void>;
}

export function startCapture(batchesDir: string, port: number): Promise<Capture> {
  mkdirSync(batchesDir, { recursive: true });
  let n = 0;
  const server: Server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      const body = Buffer.concat(chunks);
      const path = (req.url ?? "").split("?")[0] ?? "";
      const contentType = req.headers["content-type"] ?? "";
      const signal = path === "/v1/traces" ? "traces" : path === "/v1/logs" ? "logs" : "other";
      const enc = contentType.includes("x-protobuf") ? "pb" : "json";
      const prefix = String(++n).padStart(4, "0");
      writeFileSync(join(batchesDir, `${prefix}.${signal}.${enc}`), body);
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers)) {
        if (typeof v === "string") headers[k] = v;
        else if (Array.isArray(v)) headers[k] = v.join(", ");
      }
      writeFileSync(join(batchesDir, `${prefix}.headers.json`), JSON.stringify({ path, headers }, null, 2) + "\n");
      if (enc === "pb") {
        res.writeHead(200, { "content-type": "application/x-protobuf" });
        res.end();
      } else {
        res.writeHead(200, { "content-type": "application/json" });
        res.end("{}");
      }
    });
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      resolve({
        port,
        count: () => n,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}
