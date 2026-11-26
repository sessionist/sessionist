// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// The update check: due once a day, off by config or --offline, one GET through the egress grant, the answer
// kept in config; and what the health block says about it, inventing nothing.

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "sessionist-update-"));
  process.env["SESSIONIST_DATA_DIR"] = dir;
});
afterAll(() => {
  delete process.env["SESSIONIST_DATA_DIR"];
  rmSync(dir, { recursive: true, force: true });
});

const { isAllowedHost, setOffline } = await import("../src/cli/egress.js");
const { CHECK_INTERVAL_MS, checkDue, checkForUpdate, REGISTRY_HOST, selfUpdateAbility, updateBlock } = await import(
  "../src/update/check.js"
);
const { refusalMessage, requestRestart } = await import("../src/update/restart.js");
const { loadConfig } = await import("../src/config.js");

const T0 = Date.parse("2026-11-26T12:00:00Z");
const ok = (version: string) => async () => ({ ok: true, status: 200, json: async () => ({ version }) });

afterEach(() => setOffline(false));

describe("when a check is due", () => {
  it("never with checks off, never under --offline", () => {
    expect(checkDue({ updateCheck: false }, T0)).toBe(false);
    setOffline(true);
    expect(checkDue({ updateCheck: true }, T0)).toBe(false);
  });
  it("at once when there has been none, then not again for a day", () => {
    expect(checkDue({ updateCheck: true }, T0)).toBe(true);
    const recent = new Date(T0 - 60_000).toISOString();
    expect(checkDue({ updateCheck: true, updateCheckedAt: recent }, T0)).toBe(false);
    const old = new Date(T0 - CHECK_INTERVAL_MS).toISOString();
    expect(checkDue({ updateCheck: true, updateCheckedAt: old }, T0)).toBe(true);
    expect(checkDue({ updateCheck: true, updateCheckedAt: "not a date" }, T0)).toBe(true);
  });
});

describe("the check itself", () => {
  it("asks the registry through the egress grant, for that host only, and keeps the answer", async () => {
    let grantedDuring: boolean | undefined;
    let otherDuring: boolean | undefined;
    const fetcher = async (url: string) => {
      expect(url).toBe(`https://${REGISTRY_HOST}/sessionist/latest`);
      grantedDuring = isAllowedHost(REGISTRY_HOST);
      otherDuring = isAllowedHost("example.com");
      return { ok: true, status: 200, json: async () => ({ version: "9.9.9" }) };
    };
    expect(await checkForUpdate(fetcher, T0)).toBe("9.9.9");
    expect(grantedDuring).toBe(true);
    expect(otherDuring).toBe(false);
    expect(isAllowedHost(REGISTRY_HOST)).toBe(false);
    const saved = JSON.parse(readFileSync(join(dir, "config.json"), "utf8")) as Record<string, unknown>;
    expect(saved["updateLatest"]).toBe("9.9.9");
    expect(saved["updateCheckedAt"]).toBe(new Date(T0).toISOString());
  });

  it("on failure keeps the last known version, but records the attempt so the next is a day away", async () => {
    const failing = async () => ({ ok: false, status: 503, json: async () => ({}) });
    const later = T0 + 1000;
    expect(await checkForUpdate(failing, later)).toBeUndefined();
    const config = loadConfig();
    expect(config.updateLatest).toBe("9.9.9");
    expect(config.updateCheckedAt).toBe(new Date(later).toISOString());
    expect(checkDue(config, later + 1000)).toBe(false);
  });

  it("refuses to run under --offline without calling the fetcher", async () => {
    setOffline(true);
    let called = false;
    await checkForUpdate(async () => {
      called = true;
      return { ok: true, status: 200, json: async () => ({ version: "1.0.0" }) };
    }, T0);
    expect(called).toBe(false);
    expect(loadConfig().updateLatest).toBe("9.9.9");
  });

  it("rejects an answer with no version", async () => {
    const odd = async () => ({ ok: true, status: 200, json: async () => ({ name: "sessionist" }) });
    expect(await checkForUpdate(odd, T0)).toBeUndefined();
    expect(ok("x")).toBeDefined();
  });
});

describe("whether this sink can restart onto a newer release", () => {
  const base = { supported: true, platform: "darwin" as NodeJS.Platform, installed: true };
  it("yes from the npx cache, which re-resolves the package on every start", () => {
    expect(selfUpdateAbility({ ...base, command: "/opt/homebrew/bin/npx" })).toEqual({ canSelfUpdate: true });
  });
  it("no from a fixed path, with the command to run instead", () => {
    const a = selfUpdateAbility({ ...base, command: "/opt/homebrew/bin/node" });
    expect(a).toMatchObject({ canSelfUpdate: false, reason: "fixed-path" });
    expect((a as { command: string }).command).toContain("npm i -g sessionist@latest");
  });
  it("no without a login service, and no on a platform without one", () => {
    expect(selfUpdateAbility({ ...base, installed: false })).toMatchObject({ canSelfUpdate: false, reason: "no-service" });
    expect(selfUpdateAbility({ supported: false, platform: "win32", installed: false })).toMatchObject({
      canSelfUpdate: false,
      reason: "unsupported",
    });
  });
});

describe("the health block", () => {
  const able = { canSelfUpdate: true } as const;
  it("says checks are off and why, and nothing else", () => {
    expect(updateBlock({ updateCheck: false }, "0.1.3", able)).toEqual({ checksEnabled: false, reason: "config" });
    setOffline(true);
    expect(updateBlock({ updateCheck: true }, "0.1.3", able)).toEqual({ checksEnabled: false, reason: "offline" });
  });
  it("carries no latest or available until a check has succeeded", () => {
    expect(updateBlock({ updateCheck: true }, "0.1.3", able)).toEqual({ checksEnabled: true, canSelfUpdate: true });
    const attempted = updateBlock({ updateCheck: true, updateCheckedAt: "2026-11-26T12:00:00.000Z" }, "0.1.3", able);
    expect(attempted).toEqual({ checksEnabled: true, canSelfUpdate: true, checkedAt: "2026-11-26T12:00:00.000Z" });
  });
  it("compares the known latest with the running version", () => {
    const known = { updateCheck: true, updateCheckedAt: "2026-11-26T12:00:00.000Z", updateLatest: "0.1.4" };
    expect(updateBlock(known, "0.1.3", able)).toMatchObject({ latest: "0.1.4", available: true });
    expect(updateBlock(known, "0.1.4", able)).toMatchObject({ latest: "0.1.4", available: false });
    expect(updateBlock(known, "0.2.0", able)).toMatchObject({ available: false });
  });
});

describe("the restart decision", () => {
  const able = { canSelfUpdate: true } as const;
  it("refuses while a run is recording, in the CLI's words, unless told to go anyway", async () => {
    const calls: number[] = [];
    const refused = requestRestart({ now: false, running: 2, gapMinutes: 10, ability: able, version: "0.1.3", restart: () => calls.push(1) });
    expect(refused).toEqual({ refused: true, running: 2, message: refusalMessage(2, 10) });
    expect(refusalMessage(1, 10, "run again with --now")).toContain("1 session is still recording");
    const went = requestRestart({ now: true, running: 2, gapMinutes: 10, ability: able, version: "0.1.3", restart: () => calls.push(2) });
    expect(went).toEqual({ restarting: true, from: "0.1.3" });
    await new Promise((r) => setTimeout(r, 300));
    expect(calls).toEqual([2]);
  });
  it("refuses outright when a restart would not bring a newer release", () => {
    const fixed = { canSelfUpdate: false as const, reason: "fixed-path" as const, command: "npm i -g sessionist@latest" };
    expect(requestRestart({ now: true, running: 0, gapMinutes: 10, ability: fixed, version: "0.1.3", restart: () => {} })).toEqual({
      refused: true,
      reason: "fixed-path",
      command: "npm i -g sessionist@latest",
    });
  });
});
