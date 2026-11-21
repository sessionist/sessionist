// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// OTLP/HTTP receiver: standard OTLP only; a malformed batch gets a 400 and never crashes the process.

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { gunzipSync } from "node:zlib";
import { decodeLogsJson, decodeTracesJson } from "./decode-json.js";
import { decodeLogsProtobuf, decodeTracesProtobuf } from "./decode-protobuf.js";
import type { RawLogRecord, RawSpan } from "./raw-span.js";

export interface ReceiverHandlers {
  onSpans(spans: RawSpan[]): void;
  onLogs(logs: RawLogRecord[]): void;
  onError?(context: string, err: unknown): void;
}

const MAX_BODY_BYTES = 128 * 1024 * 1024;

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function isProtobuf(req: IncomingMessage): boolean {
  const ct = req.headers["content-type"] ?? "";
  return ct.includes("application/x-protobuf");
}

function respondSuccess(req: IncomingMessage, res: ServerResponse): void {
  if (isProtobuf(req)) {
    // An empty Export*ServiceResponse message encodes to zero bytes.
    res.writeHead(200, { "content-type": "application/x-protobuf" });
    res.end();
  } else {
    res.writeHead(200, { "content-type": "application/json" });
    res.end("{}");
  }
}

function respondError(req: IncomingMessage, res: ServerResponse, status: number, message: string): void {
  // google.rpc.Status JSON shape, per the OTLP/HTTP failure contract.
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify({ code: status === 400 ? 3 : 2, message }));
}

/** Exported for tests: the exact request-processing path, minus sockets. */
export function handleOtlpBody(
  path: string,
  contentType: string,
  contentEncoding: string | undefined,
  body: Buffer,
  handlers: ReceiverHandlers,
): void {
  const decoded = contentEncoding === "gzip" ? gunzipSync(body) : body;
  const protobuf = contentType.includes("application/x-protobuf");
  if (path === "/v1/traces") {
    const spans = protobuf ? decodeTracesProtobuf(decoded) : decodeTracesJson(decoded.toString("utf8"));
    if (spans.length > 0) handlers.onSpans(spans);
  } else if (path === "/v1/logs") {
    const logs = protobuf ? decodeLogsProtobuf(decoded) : decodeLogsJson(decoded.toString("utf8"));
    if (logs.length > 0) handlers.onLogs(logs);
  }
  // /v1/metrics: accepted and discarded; rejecting would error-spam SDKs that co-export all signals.
}

export function createReceiver(handlers: ReceiverHandlers): Server {
  return createServer(async (req, res) => {
    try {
      if (req.method !== "POST") {
        respondError(req, res, 405, "method not allowed");
        return;
      }
      const path = (req.url ?? "").split("?")[0] ?? "";
      if (path !== "/v1/traces" && path !== "/v1/logs" && path !== "/v1/metrics") {
        respondError(req, res, 404, "not found");
        return;
      }
      const body = await readBody(req);
      const encodingHeader = req.headers["content-encoding"];
      const encoding = Array.isArray(encodingHeader) ? encodingHeader[0] : encodingHeader;
      try {
        handleOtlpBody(path, req.headers["content-type"] ?? "", encoding, body, handlers);
      } catch (err) {
        handlers.onError?.(`decode ${path}`, err);
        respondError(req, res, 400, err instanceof Error ? err.message : "malformed payload");
        return;
      }
      respondSuccess(req, res);
    } catch (err) {
      handlers.onError?.("receiver", err);
      if (!res.headersSent) respondError(req, res, 500, "internal error");
      else res.end();
    }
  });
}
