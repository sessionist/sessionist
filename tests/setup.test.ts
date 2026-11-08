// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// Tests the two-step install (`npx sessionist` attaches a reader, /sessionist-connect wires the
// agent) with the `claude` CLI stubbed by PATH, so nothing touches the real CLI or ~/.claude.json.

import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { detect, isFullyAttached, isSkillInstalled, MCP_SERVER_NAME } from "../src/setup/detect.js";
import {
  applySetup,
  cliInvocation,
  findOnPath,
  manualSteps,
  mcpAddArgs,
  mcpAddCommand,
  mcpJsonBlock,
  mcpServerCommand,
  runnableEntry,
  skillInstallCommand,
  stableNodePath,
} from "../src/setup/apply.js";
import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { isAbsolute } from "node:path";
import { installSkill } from "../src/cli/skill.js";
import { installService } from "../src/service/install.js";

const STUB = `#!/bin/sh
echo "$@" >> "$CLAUDE_STUB_LOG"
case "$1 $2" in
  "mcp get") exit "\${CLAUDE_STUB_GET_EXIT:-1}" ;;
  "mcp add")
    if [ "\${CLAUDE_STUB_ADD_EXIT:-0}" != "0" ]; then
      echo "stub refused to add" >&2
      exit "\$CLAUDE_STUB_ADD_EXIT"
    fi
    exit 0 ;;
esac
exit 0
`;

let dir: string;
let binDir: string;
let skillsRoot: string;
let originalPath: string | undefined;

/** Every applySetup/detect call in this file must pass this: without it the service step
 *  writes a real LaunchAgent into the developer's home and runs real launchctl. */
function isolatedService(): { homeDir: string; dataDir: string; runCommand: () => { status: number } } {
  return {
    homeDir: join(dir, "svchome"),
    dataDir: join(dir, "svcdata"),
    runCommand: () => ({ status: 0 }),
  };
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "sessionist-setup-"));
  binDir = join(dir, "bin");
  skillsRoot = join(dir, "skills");
  mkdirSync(binDir, { recursive: true });
  originalPath = process.env["PATH"];
  process.env["CLAUDE_STUB_LOG"] = join(dir, "calls.log");
  writeFileSync(process.env["CLAUDE_STUB_LOG"], "");
});

afterEach(() => {
  if (originalPath !== undefined) process.env["PATH"] = originalPath;
  delete process.env["CLAUDE_STUB_LOG"];
  delete process.env["CLAUDE_STUB_GET_EXIT"];
  delete process.env["CLAUDE_STUB_ADD_EXIT"];
  rmSync(dir, { recursive: true, force: true });
});

/** Put a fake `claude` on PATH, and nothing else, so a missing stub means a missing CLI. */
function stubClaude(): void {
  const path = join(binDir, "claude");
  writeFileSync(path, STUB);
  chmodSync(path, 0o755);
  process.env["PATH"] = binDir;
}

function withoutClaude(): void {
  process.env["PATH"] = binDir; // empty: no claude anywhere
}

function stubCalls(): string[] {
  return readFileSync(process.env["CLAUDE_STUB_LOG"]!, "utf8").trim().split("\n").filter(Boolean);
}

describe("detect", () => {
  it("reports no CLI, with a reason, when claude is not on PATH", () => {
    withoutClaude();
    const d = detect(skillsRoot);
    expect(d.claudeCli).toBe(false);
    expect(d.mcpRegistered).toBe(false);
    expect(d.note).toContain("not on PATH");
  });

  it("asks only about our own server, never for a health check of every server", () => {
    stubClaude();
    detect(skillsRoot);
    const calls = stubCalls();
    expect(calls.some((c) => c.startsWith(`mcp get ${MCP_SERVER_NAME}`))).toBe(true);
    // `claude mcp list` probes every configured server over the network.
    expect(calls.some((c) => c.startsWith("mcp list"))).toBe(false);
  });

  it("sees a registered server when the CLI confirms one", () => {
    stubClaude();
    process.env["CLAUDE_STUB_GET_EXIT"] = "0";
    expect(detect(skillsRoot).mcpRegistered).toBe(true);
  });

  it("counts a stale or edited skill copy as not installed, so setup refreshes it", () => {
    installSkill(skillsRoot);
    expect(isSkillInstalled(skillsRoot)).toBe(true);
    writeFileSync(join(skillsRoot, "sessionist-connect", "SKILL.md"), "---\nname: x\n---\nedited\n");
    expect(isSkillInstalled(skillsRoot)).toBe(false);
  });

  it("is fully attached only when the reader and the service are all present", () => {
    stubClaude();
    process.env["CLAUDE_STUB_GET_EXIT"] = "0";
    // A temp home, so this never reads the developer's own LaunchAgents directory.
    const svc = { homeDir: join(dir, "svchome"), dataDir: join(dir, "svcdata") };
    expect(isFullyAttached(detect(skillsRoot, svc))).toBe(false);
    installSkill(skillsRoot);
    // Reader attached, but capture still dies with the terminal.
    expect(isFullyAttached(detect(skillsRoot, svc))).toBe(false);
    installService({ command: { program: "/bin/true", args: [] }, activateNow: false, ...svc, runCommand: () => ({ status: 0 }) });
    expect(isFullyAttached(detect(skillsRoot, svc))).toBe(true);
  });

  it("counts a platform with no service mechanism as satisfied, rather than nagging forever", () => {
    stubClaude();
    process.env["CLAUDE_STUB_GET_EXIT"] = "0";
    installSkill(skillsRoot);
    const windows = { platform: "win32" as NodeJS.Platform, homeDir: join(dir, "winhome") };
    const d = detect(skillsRoot, windows);
    expect(d.serviceSupported).toBe(false);
    expect(isFullyAttached(d)).toBe(true);
  });
});

describe("applySetup", () => {
  it("registers at user scope, not the CLI's project-local default", () => {
    stubClaude();
    const result = applySetup(skillsRoot, detect(skillsRoot, isolatedService()), false, isolatedService());
    expect(result.mcp.done).toBe(true);
    const add = stubCalls().find((c) => c.startsWith("mcp add"))!;
    expect(add).toContain("-s user");
    // The printed command must match what we actually run, since the failure path
    // tells the user to type it.
    expect(mcpAddArgs().join(" ")).toContain("-s user");
    expect(mcpAddCommand().startsWith("claude mcp add")).toBe(true);
    expect(add).toContain(mcpServerCommand().command);
  });

  it("never registers `npx sessionist` while the registry serves only the name stub", () => {
    // npm resolves the 0.0.1 reservation stub, which has no bin, so a registration pointing
    // at npx would hand the coding agent a server that cannot start.
    stubClaude();
    applySetup(skillsRoot, detect(skillsRoot, isolatedService()), false, isolatedService());
    const add = stubCalls().find((c) => c.startsWith("mcp add"))!;
    expect(add).not.toContain("npx");
    const { command, args } = mcpServerCommand();
    expect(args[args.length - 1]).toBe("mcp");
    // The node must be the binary running us, reached by an absolute path.
    expect(isAbsolute(command)).toBe(true);
    expect(realpathSync(command)).toBe(realpathSync(process.execPath));
    expect(existsSync(args[0]!)).toBe(true);
    // And it must be something node can actually load. A `.ts` entry here would
    // spawn-fail later: node resolves its relative imports to `.js`.
    expect(args[0]!.endsWith(".ts")).toBe(false);
    expect(skillInstallCommand()).not.toContain("npx");
  });

  it("never registers a bare name or the bin shim: launchd has no PATH for them", () => {
    // `launchctl getenv PATH` is empty on a stock Mac, so a user agent cannot find a bare
    // `sessionist`, and the shim's `#!/usr/bin/env node` fails the same way one step later.
    const { command, args } = cliInvocation("serve");
    expect(isAbsolute(command)).toBe(true);
    expect(isAbsolute(args[0]!)).toBe(true);
    expect(args[0]!.endsWith("cli.js")).toBe(true);
  });

  it("prefers the PATH symlink to node over the version-pinned real path", () => {
    // process.execPath follows Homebrew's symlink into a Cellar directory that the next
    // `brew upgrade node` deletes. When PATH has a symlink to the same binary, use it.
    const onPath = findOnPath("node");
    const chosen = stableNodePath();
    if (onPath !== undefined && realpathSync(onPath) === realpathSync(process.execPath)) {
      expect(chosen).toBe(onPath);
    } else {
      expect(chosen).toBe(process.execPath);
    }
  });

  it("finds executables on PATH as absolute paths, and nothing when absent", () => {
    stubClaude();
    expect(findOnPath("claude")).toBe(join(binDir, "claude"));
    expect(findOnPath("definitely-not-a-real-binary")).toBeUndefined();
  });

  it("points at the built bundle, which is what node can run", () => {
    const entry = runnableEntry();
    expect(entry).toBeDefined();
    const check = spawnSync(process.execPath, [entry!, "version"], { encoding: "utf8", timeout: 20_000 });
    expect(check.status).toBe(0);
    expect((check.stdout ?? "").trim()).not.toBe("");
  });

  it("installs the skill and reports both steps", () => {
    stubClaude();
    const result = applySetup(skillsRoot, detect(skillsRoot, isolatedService()), false, isolatedService());
    expect(result.skill.done).toBe(true);
    expect(existsSync(join(skillsRoot, "sessionist-connect", "SKILL.md"))).toBe(true);
  });

  it("installs the skill even when the CLI is missing: a reader half-attached beats none", () => {
    withoutClaude();
    const result = applySetup(skillsRoot, detect(skillsRoot, isolatedService()), false, isolatedService());
    expect(result.mcp.done).toBe(false);
    expect(result.mcp.detail).toContain("claude mcp add");
    expect(result.skill.done).toBe(true);
  });

  it("surfaces the CLI's own error rather than swallowing it", () => {
    stubClaude();
    process.env["CLAUDE_STUB_ADD_EXIT"] = "3";
    const result = applySetup(skillsRoot, detect(skillsRoot, isolatedService()), false, isolatedService());
    expect(result.mcp.done).toBe(false);
    expect(result.mcp.detail).toContain("stub refused to add");
    expect(result.mcp.detail).toContain("claude mcp add");
  });

  it("is idempotent: an already-registered server is not added again", () => {
    stubClaude();
    process.env["CLAUDE_STUB_GET_EXIT"] = "0";
    const result = applySetup(skillsRoot, detect(skillsRoot, isolatedService()), false, isolatedService());
    expect(result.mcp.done).toBe(true);
    expect(result.mcp.detail).toContain("already registered");
    expect(stubCalls().some((c) => c.startsWith("mcp add"))).toBe(false);
  });
});

describe("what the user is told when setup does not run", () => {
  it("lists only what is missing, and drops each line as it is done", () => {
    stubClaude();
    const svc = isolatedService();
    const cli = skillInstallCommand();
    expect(manualSteps(detect(skillsRoot, svc))).toEqual([
      mcpAddCommand(),
      `${cli} skill install`,
      `${cli} service install`,
    ]);

    installSkill(skillsRoot);
    expect(manualSteps(detect(skillsRoot, svc))).toEqual([mcpAddCommand(), `${cli} service install`]);

    installService({ command: { program: "/bin/true", args: [] }, activateNow: false, ...svc });
    expect(manualSteps(detect(skillsRoot, svc))).toEqual([mcpAddCommand()]);
  });

  it("never suggests a service on a platform that has none", () => {
    stubClaude();
    installSkill(skillsRoot);
    const windows = { platform: "win32" as NodeJS.Platform, homeDir: join(dir, "winhome") };
    expect(manualSteps(detect(skillsRoot, windows)).some((s) => s.includes("service"))).toBe(false);
  });

  it("offers a pasteable server block matching what it would register itself", () => {
    const parsed = JSON.parse(mcpJsonBlock()) as {
      mcpServers: Record<string, { command: string; args: string[] }>;
    };
    expect(parsed.mcpServers[MCP_SERVER_NAME]).toEqual(mcpServerCommand());
  });
});
