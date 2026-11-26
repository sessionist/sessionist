// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// Tests the two-step install (`npx sessionist` attaches a reader, /sessionist-connect wires the
// agent) with the `claude` CLI stubbed by PATH, so nothing touches the real CLI or ~/.claude.json.

import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { detect, isFullyAttached, isSkillInstalled, parseMcpGet, MCP_SERVER_NAME } from "../src/setup/detect.js";
import {
  applySetup,
  cliInvocation,
  findOccupancy,
  findOnPath,
  manualSteps,
  occupancyDetail,
  type Occupancy,
  mcpAddArgs,
  mcpAddCommand,
  mcpJsonBlock,
  mcpServerCommand,
  runnableEntry,
  serviceCommand,
  servicePath,
  skillInstallCommand,
  stableNodePath,
} from "../src/setup/apply.js";
import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { delimiter, dirname, isAbsolute } from "node:path";
import { installSkill } from "../src/cli/skill.js";
import { installService } from "../src/service/install.js";

const STUB = `#!/bin/sh
echo "$@" >> "$CLAUDE_STUB_LOG"
case "$1 $2" in
  "mcp get")
    if [ -n "\${CLAUDE_STUB_GET_OUTPUT:-}" ]; then printf '%s\\n' "$CLAUDE_STUB_GET_OUTPUT"; fi
    exit "\${CLAUDE_STUB_GET_EXIT:-1}" ;;
  "mcp remove") exit "\${CLAUDE_STUB_REMOVE_EXIT:-0}" ;;
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
  delete process.env["CLAUDE_STUB_GET_OUTPUT"];
  delete process.env["CLAUDE_STUB_REMOVE_EXIT"];
  delete process.env["CLAUDE_STUB_ADD_EXIT"];
  rmSync(dir, { recursive: true, force: true });
});

/** What `claude mcp get` prints for a registration, in the CLI's own layout. */
function mcpGetOutput(scope: string, command: string, args: string): string {
  return `${MCP_SERVER_NAME}:\n  Scope: ${scope}\n  Status: ✔ Connected\n  Type: stdio\n  Command: ${command}\n  Args: ${args}\n  Environment:\n`;
}

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

  it("gives the service a PATH holding its program and node, then the system directories", () => {
    // launchd user agents and systemd --user units get none of the shell's PATH, so an `npx`
    // command, which must find `node`, dies at spawn without this.
    const path = servicePath("/opt/homebrew/bin/npx").split(delimiter);
    expect(path[0]).toBe("/opt/homebrew/bin");
    expect(path).toContain(dirname(stableNodePath()));
    expect(path).toContain("/usr/bin");
    expect(new Set(path).size).toBe(path.length);
    expect(path.every((d) => isAbsolute(d))).toBe(true);

    const cmd = serviceCommand();
    expect(cmd.env?.["PATH"]?.split(delimiter)[0]).toBe(dirname(cmd.program));
    expect(cmd.args[cmd.args.length - 1]).toBe("serve");
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

  it("leaves a registration that already names this install alone", () => {
    stubClaude();
    const { command, args } = mcpServerCommand();
    process.env["CLAUDE_STUB_GET_EXIT"] = "0";
    process.env["CLAUDE_STUB_GET_OUTPUT"] = mcpGetOutput("User config (available in all your projects)", command, args.join(" "));
    const d = detect(skillsRoot, isolatedService());
    expect(d.mcpCommand).toBe(`${command} ${args.join(" ")}`);
    expect(d.mcpScope).toBe("user");
    const result = applySetup(skillsRoot, d, false, isolatedService());
    expect(result.mcp.detail).toContain("already registered");
    expect(stubCalls().some((c) => c.startsWith("mcp remove") || c.startsWith("mcp add"))).toBe(false);
  });

  it("re-points a user-scope registration made by a different install, and says what it was", () => {
    // Registered earlier from the npx cache, now set up from a global install: reader and sink must be
    // the same build, so the registration follows the install that runs setup.
    stubClaude();
    process.env["CLAUDE_STUB_GET_EXIT"] = "0";
    process.env["CLAUDE_STUB_GET_OUTPUT"] = mcpGetOutput("User config (available in all your projects)", "/usr/local/bin/npx", "-y sessionist mcp");
    const result = applySetup(skillsRoot, detect(skillsRoot, isolatedService()), false, isolatedService());
    expect(result.mcp.done).toBe(true);
    expect(result.mcp.detail).toContain("re-registered");
    expect(result.mcp.detail).toContain("was /usr/local/bin/npx -y sessionist mcp");
    const calls = stubCalls();
    expect(calls.some((c) => c === `mcp remove ${MCP_SERVER_NAME} -s user`)).toBe(true);
    expect(calls.findIndex((c) => c.startsWith("mcp remove"))).toBeLessThan(calls.findIndex((c) => c.startsWith("mcp add")));
  });

  it("leaves a project-scope registration alone, since a user-scope add beside it would make two", () => {
    stubClaude();
    process.env["CLAUDE_STUB_GET_EXIT"] = "0";
    process.env["CLAUDE_STUB_GET_OUTPUT"] = mcpGetOutput("Project config (shared via .mcp.json)", "/usr/local/bin/npx", "-y sessionist mcp");
    const result = applySetup(skillsRoot, detect(skillsRoot, isolatedService()), false, isolatedService());
    expect(result.mcp.done).toBe(true);
    expect(result.mcp.detail).toContain("project scope");
    expect(stubCalls().some((c) => c.startsWith("mcp remove") || c.startsWith("mcp add"))).toBe(false);
  });

  it("reports a failed replacement with both commands to run by hand", () => {
    stubClaude();
    process.env["CLAUDE_STUB_GET_EXIT"] = "0";
    process.env["CLAUDE_STUB_REMOVE_EXIT"] = "2";
    process.env["CLAUDE_STUB_GET_OUTPUT"] = mcpGetOutput("User config", "/usr/local/bin/npx", "-y sessionist mcp");
    const result = applySetup(skillsRoot, detect(skillsRoot, isolatedService()), false, isolatedService());
    expect(result.mcp.done).toBe(false);
    expect(result.mcp.detail).toContain(`claude mcp remove ${MCP_SERVER_NAME} -s user`);
    expect(result.mcp.detail).toContain("claude mcp add");
    expect(stubCalls().some((c) => c.startsWith("mcp add"))).toBe(false);
  });
});

describe("parseMcpGet", () => {
  it("reads scope, command and args from the CLI's layout, and nothing from a blank answer", () => {
    expect(parseMcpGet(mcpGetOutput("Local config (private to you in this project)", "/opt/node", "/x/cli.js mcp"))).toEqual({
      command: "/opt/node /x/cli.js mcp",
      scope: "local",
    });
    expect(parseMcpGet(mcpGetOutput("Somewhere new", "/opt/node", ""))).toEqual({ command: "/opt/node", scope: "unknown" });
    expect(parseMcpGet("")).toBeUndefined();
  });
});

describe("a port already held", () => {
  const holderOf = (table: Record<number, { pid: number; command?: string }>) => (port: number) => table[port];

  it("is ours when the sink answers, and names the process behind it", () => {
    const occ = findOccupancy(4318, 4319, { version: "0.1.2", uptimeMs: 10, pid: 77 }, holderOf({ 4319: { pid: 77, command: "node cli.js serve" } }));
    expect(occ).toEqual({ port: 4319, key: "apiPort", sink: true, holder: { pid: 77, command: "node cli.js serve" } });
    const detail = occupancyDetail(occ as Occupancy, "sessionist");
    expect(detail).toContain("PID 77");
    expect(detail).toContain("Sessionist sink started from a shell");
    expect(detail).toContain("sessionist service install");
  });

  it("falls back to the PID the sink reports when the system tools cannot name one", () => {
    const occ = findOccupancy(4318, 4319, { version: "0.1.2", uptimeMs: 10, pid: 77 }, () => undefined);
    expect(occ).toEqual({ port: 4319, key: "apiPort", sink: true, holder: { pid: 77 } });
  });

  it("is a stranger when nothing of ours answers but a port is held, and says which setting to change", () => {
    const occ = findOccupancy(4318, 4319, undefined, holderOf({ 4318: { pid: 500, command: "otelcol" } }));
    expect(occ).toEqual({ port: 4318, key: "otlpPort", sink: false, holder: { pid: 500, command: "otelcol" } });
    const detail = occupancyDetail(occ as Occupancy, "sessionist");
    expect(detail).toContain("not a Sessionist sink");
    expect(detail).toContain("config set otlpPort");
  });

  it("is nothing when both ports are free", () => {
    expect(findOccupancy(4318, 4319, undefined, () => undefined)).toBe(false);
  });

  it("keeps the service from starting, and the step says so with the holder", () => {
    stubClaude();
    const occ: Occupancy = { port: 4319, key: "apiPort", sink: true, holder: { pid: 77, command: "node cli.js serve" } };
    const svc = isolatedService();
    const result = applySetup(skillsRoot, detect(skillsRoot, svc), occ, svc);
    expect(result.service.done).toBe(true);
    expect(result.service.detail).toContain("installed, not started");
    expect(result.service.detail).toContain("PID 77");
    expect(result.service.detail).toContain("next login");
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
