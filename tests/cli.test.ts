// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// Runs the built CLI as a coding agent would, flags first, and checks it answers and exits instead
// of starting the sink.

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runnableEntry } from "../src/setup/apply.js";

let dataDir: string;

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), "sessionist-cli-"));
});

afterEach(() => {
  rmSync(dataDir, { recursive: true, force: true });
});

/** A run that starts serving never exits, so the timeout is the failure. */
function run(...args: string[]): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [runnableEntry()!, ...args], {
    encoding: "utf8",
    timeout: 20_000,
    env: { ...process.env, SESSIONIST_DATA_DIR: dataDir },
  });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

describe("help and version as flags", () => {
  it("--help and -h print the usage and exit, rather than starting the sink", () => {
    for (const flag of ["--help", "-h"]) {
      const result = run(flag);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Usage:");
      expect(result.stdout).toContain("sessionist setup");
      expect(result.stdout).not.toContain("Capturing.");
    }
  });

  it("--version and -v print the version and exit", () => {
    for (const flag of ["--version", "-v"]) {
      const result = run(flag);
      expect(result.status).toBe(0);
      expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
    }
  });

  it("<command> --help prints that command's own usage", () => {
    const exp = run("export", "--help");
    expect(exp.status).toBe(0);
    expect(exp.stdout).toContain("usage: sessionist export");
    expect(exp.stderr).toBe("");

    const service = run("service", "--help");
    expect(service.status).toBe(0);
    expect(service.stdout).toContain("usage: sessionist service");

    const setup = run("setup", "--help");
    expect(setup.status).toBe(0);
    expect(setup.stdout).toContain("usage: sessionist setup");

    // Asking about update must never restart anything.
    const update = run("update", "--help");
    expect(update.status).toBe(0);
    expect(update.stdout).toContain("usage: sessionist update");
  });

  it("--json wraps the help for a machine", () => {
    const result = run("--help", "--json");
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout) as { commands: string[]; help: string };
    expect(parsed.commands).toContain("setup");
    expect(parsed.help).toContain("Usage:");
  });

  it("still rejects an unknown command, with the usage", () => {
    const result = run("frobnicate");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("unknown command");
  });
});
