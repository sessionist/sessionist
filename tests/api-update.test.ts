// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// The first mutating endpoint: POST /api/update answers the viewer served by this sink and nobody else, and
// /api/health carries the update block unchanged.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApiServer, type ApiServer } from "../src/api/http.js";
import { openDb, type Db } from "../src/store/db.js";
import type { UpdateBlock } from "../src/update/check.js";
import type { RestartOutcome } from "../src/update/restart.js";

let dir: string;
let db: Db;
let api: ApiServer;
let base: string;
const asked: boolean[] = [];
let outcome: RestartOutcome = { restarting: true, from: "0.1.3" };
const block: UpdateBlock = {
  checksEnabled: true,
  checkedAt: "2026-11-26T12:00:00.000Z",
  latest: "0.1.4",
  available: true,
  canSelfUpdate: true,
};

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "sessionist-api-update-"));
  db = openDb(dir);
  api = createApiServer({
    db,
    dataDir: dir,
    version: "0.1.3",
    update: () => block,
    restart: (now) => {
      asked.push(now);
      return outcome;
    },
  });
  api.server.listen(0, "127.0.0.1");
  await new Promise((r) => api.server.once("listening", r));
  const port = (api.server.address() as AddressInfo).port;
  base = `http://127.0.0.1:${String(port)}`;
});

afterAll(() => {
  api.server.close();
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

const post = (headers: Record<string, string>, body?: unknown) =>
  fetch(`${base}/api/update`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

describe("/api/health", () => {
  it("carries the update block as the sink computed it", async () => {
    const health = (await (await fetch(`${base}/api/health`)).json()) as { update: unknown; version: string };
    expect(health.version).toBe("0.1.3");
    expect(health.update).toEqual(block);
  });
});

describe("POST /api/update", () => {
  it("refuses without the action header, and refuses a foreign origin even with it", async () => {
    expect((await post({})).status).toBe(403);
    expect((await post({ origin: "https://example.com", "x-sessionist-action": "update" })).status).toBe(403);
    expect((await post({ origin: "null", "x-sessionist-action": "update" })).status).toBe(403);
    expect(asked).toEqual([]);
  });

  it("answers the viewer on this machine, and the reply carries no CORS header", async () => {
    const res = await post({ origin: base, "x-sessionist-action": "update" });
    expect(res.status).toBe(202);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    expect(await res.json()).toEqual({ restarting: true, from: "0.1.3" });
    expect(asked).toEqual([false]);
  });

  it("passes `now` through, and reports a refusal as 409 with the sink's words", async () => {
    outcome = { refused: true, running: 1, message: "1 session is still recording" };
    const res = await post({ "x-sessionist-action": "update" }, { now: true });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual(outcome);
    expect(asked[asked.length - 1]).toBe(true);
  });

  it("is not reachable by GET, and other methods stay 405", async () => {
    expect((await fetch(`${base}/api/update`)).status).toBe(404);
    expect((await fetch(`${base}/api/update`, { method: "DELETE" })).status).toBe(405);
    expect((await fetch(`${base}/api/sessions`, { method: "POST" })).status).toBe(405);
  });
});
