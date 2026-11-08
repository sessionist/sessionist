// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// A malformed batch gets a 400 without taking the receiver down, and a weird-but-valid batch
// still renders as a session of passthrough events.

import { existsSync } from "node:fs";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { createReceiver } from "../src/receiver/server.js";
import type { RawSpan } from "../src/receiver/raw-span.js";
import { loadFixtureBatches, runPipeline } from "./helpers/replay.js";

const FIXTURES_DIR = join(import.meta.dirname, "..", "fixtures");
const TRUNCATED = join(FIXTURES_DIR, "malformed", "truncated-protobuf");
const UNRECOGNIZED = join(FIXTURES_DIR, "malformed", "unrecognized-operation-json");

describe.skipIf(!existsSync(TRUNCATED))("truncated protobuf batch", () => {
  let server: Server;
  let base: string;
  const received: RawSpan[][] = [];

  beforeAll(async () => {
    server = createReceiver({
      onSpans: (spans) => received.push(spans),
      onLogs: () => {},
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => {
    server.close();
  });

  it("gets a 400 and the receiver stays up for the next good batch", async () => {
    const [batch] = loadFixtureBatches(TRUNCATED);
    expect(batch).toBeDefined();
    const headers: Record<string, string> = { "content-type": batch!.contentType };
    if (batch!.contentEncoding !== undefined) headers["content-encoding"] = batch!.contentEncoding;
    const bad = await fetch(`${base}/v1/traces`, {
      method: "POST",
      headers,
      body: new Uint8Array(batch!.body),
    });
    expect(bad.status).toBe(400);

    // Receiver is still alive and still processes valid OTLP.
    const good = await fetch(`${base}/v1/traces`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        resourceSpans: [
          {
            resource: { attributes: [{ key: "service.name", value: { stringValue: "post-crash" } }] },
            scopeSpans: [
              {
                spans: [
                  {
                    traceId: "0af7651916cd43dd8448eb211c80319c",
                    spanId: "b7ad6b7169203331",
                    name: "still-alive",
                    kind: 1,
                    startTimeUnixNano: "1756100000000000000",
                    endTimeUnixNano: "1756100001000000000",
                  },
                ],
              },
            ],
          },
        ],
      }),
    });
    expect(good.status).toBe(200);
    expect(received).toHaveLength(1);
    expect(received[0]![0]!.name).toBe("still-alive");
  });
});

describe.skipIf(!existsSync(UNRECOGNIZED))("unrecognized operation batch", () => {
  it("renders as a session of plain spans with attrs preserved verbatim", () => {
    const result = runPipeline(UNRECOGNIZED);
    expect(result.sessions.length).toBeGreaterThanOrEqual(1);
    const events = Object.values(result.timelines).flat();
    expect(events.length).toBeGreaterThan(0);
    for (const event of events) {
      // An operation name outside the convention must never map to a typed
      // event by guesswork, whatever other gen_ai.* attributes survive.
      expect(event.type).toBe("span");
    }
    // The mutated attribute namespace survives untouched.
    const attrKeys = events.flatMap((e) => Object.keys(e.attrs));
    expect(attrKeys.some((k) => k.startsWith("x_ai."))).toBe(true);
  });
});
