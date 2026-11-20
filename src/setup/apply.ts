// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// Attach a reader: register the MCP server with Claude Code and install the shipped skill; ~/.claude.json is written only through the claude CLI, and no failure here blocks capture.

import { spawnSync } from "node:child_process";
import { accessSync, constants, existsSync, realpathSync, statSync } from "node:fs";
import { basename, delimiter, dirname, isAbsolute, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { installSkill, userSkillsRoot, SKILL_NAME } from "../cli/skill.js";
import { MCP_SERVER_NAME, detect, type Detection } from "./detect.js";
import { installService, serviceFile, type ServiceEnv } from "../service/install.js";
import type { ServiceCommand } from "../service/templates.js";

const ADD_TIMEOUT_MS = 20_000;

/** How to start our own MCP server, resolved from how this process was started. */
export function mcpServerCommand(): { command: string; args: string[] } {
  return cliInvocation("mcp");
}

/** `<absolute node> <absolute cli.js> <sub>`: launchd user agents get no PATH from the shell, so every path
 *  is absolute, and an npx cache path is never registered directly because the cache is evicted; from the
 *  cache it is `<absolute npx> -y sessionist <sub>`, which re-fetches on demand and never stops to ask. */
export function cliInvocation(subcommand: string): { command: string; args: string[] } {
  const entry = runnableEntry();
  if (entry !== undefined && !entry.includes(`${sep}_npx${sep}`)) {
    return { command: stableNodePath(), args: [entry, subcommand] };
  }
  return { command: findOnPath("npx") ?? "npx", args: ["-y", "sessionist", subcommand] };
}

/** The directories the login service can search, since the supervisor hands it none of the shell's PATH:
 *  wherever the program and node live, then the system defaults. */
export function servicePath(program: string): string {
  const dirs = [dirname(program), dirname(stableNodePath()), "/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"];
  return dirs.filter((d, i) => isAbsolute(d) && dirs.indexOf(d) === i).join(delimiter);
}

/** The full command for the login service: what to run, and the PATH to run it with. */
export function serviceCommand(): ServiceCommand {
  const { command, args } = cliInvocation("serve");
  return { program: command, args, env: { PATH: servicePath(command) } };
}

/** process.execPath resolves into a version-pinned Homebrew directory; prefer the PATH symlink when it
 *  points at the same binary. */
export function stableNodePath(): string {
  const onPath = findOnPath("node");
  if (onPath === undefined) return process.execPath;
  try {
    return realpathSync(onPath) === realpathSync(process.execPath) ? onPath : process.execPath;
  } catch {
    return process.execPath;
  }
}

export function findOnPath(name: string): string | undefined {
  const dirs = (process.env["PATH"] ?? "").split(delimiter).filter((d) => d !== "");
  for (const dir of dirs) {
    const candidate = join(dir, name);
    try {
      accessSync(candidate, constants.X_OK);
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      // not here
    }
  }
  return undefined;
}

/** A script plain `node` can execute: this bundle when built, else the built dist/cli.js beside a source
 *  checkout; anchored to this module, never process.argv[1], which is the test runner under vitest. */
export function runnableEntry(): string | undefined {
  const self = fileURLToPath(import.meta.url);
  if (!self.endsWith(".ts")) return existsSync(self) ? self : undefined;

  // <root>/src/setup/apply.ts → <root>/dist/cli.js
  const marker = `${sep}src${sep}`;
  const at = self.lastIndexOf(marker);
  if (at === -1) return undefined;
  const built = join(self.slice(0, at), "dist", "cli.js");
  return existsSync(built) ? built : undefined;
}

/** A source checkout with nothing built cannot name a working command for the MCP server. */
export function needsBuild(): boolean {
  return runnableEntry() === undefined && fileURLToPath(import.meta.url).endsWith(".ts");
}

/** User scope: `claude mcp add` defaults to local, which would register only in the cwd. */
export function mcpAddArgs(): string[] {
  const { command, args } = mcpServerCommand();
  return ["mcp", "add", MCP_SERVER_NAME, "-s", "user", "--", command, ...args];
}

/** The command as a user would type it, for printing when we cannot run it. */
export function mcpAddCommand(): string {
  return `claude ${mcpAddArgs().join(" ")}`;
}

/** The config block for coding agents that have no CLI to call. */
export function mcpJsonBlock(): string {
  return JSON.stringify({ mcpServers: { [MCP_SERVER_NAME]: mcpServerCommand() } }, null, 2);
}

export interface StepResult {
  done: boolean;
  detail: string;
}

export interface ApplyResult {
  mcp: StepResult;
  skill: StepResult;
  service: StepResult;
}

function registerMcp(detection: Detection): StepResult {
  if (detection.mcpRegistered) {
    return { done: true, detail: `already registered with Claude Code as "${MCP_SERVER_NAME}"` };
  }
  if (needsBuild()) {
    return {
      done: false,
      detail: "nothing runnable to register: this is a source checkout with no build — run `npm run build` first",
    };
  }
  const command = mcpAddCommand();
  if (!detection.claudeCli) {
    return { done: false, detail: `claude CLI not found; run: ${command}` };
  }
  const run = spawnSync("claude", mcpAddArgs(), { encoding: "utf8", timeout: ADD_TIMEOUT_MS });
  if (run.error !== undefined) {
    return { done: false, detail: `could not run the claude CLI (${run.error.message}); run: ${command}` };
  }
  if (run.status !== 0) {
    // Never swallow the CLI's own diagnosis; it is the only thing that explains the failure.
    const stderr = (run.stderr ?? "").trim().split("\n")[0] ?? `exit ${String(run.status)}`;
    return { done: false, detail: `claude mcp add failed (${stderr}); run: ${command}` };
  }
  const { command: bin, args } = mcpServerCommand();
  return {
    done: true,
    detail: `registered with Claude Code as "${MCP_SERVER_NAME}" (user scope): ${bin} ${args.join(" ")}`,
  };
}

function installTheSkill(skillsRoot: string): StepResult {
  try {
    const result = installSkill(skillsRoot);
    return {
      done: true,
      detail: result.changed ? `installed /${SKILL_NAME} → ${result.path}` : `/${SKILL_NAME} already installed`,
    };
  } catch (err) {
    return { done: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

/** Do whatever is missing; safe to call repeatedly. With `sinkRunning` the service is registered but not
 *  started, since a bind failure would be retried forever. */
export function applySetup(
  skillsRoot: string = userSkillsRoot(),
  detection: Detection = detect(skillsRoot),
  sinkRunning = false,
  serviceEnv: ServiceEnv = {},
): ApplyResult {
  return {
    mcp: registerMcp(detection),
    skill: installTheSkill(skillsRoot),
    service: installTheService(detection, sinkRunning, serviceEnv),
  };
}

function installTheService(detection: Detection, sinkRunning: boolean, serviceEnv: ServiceEnv): StepResult {
  if (!detection.serviceSupported || serviceFile(serviceEnv) === undefined) {
    const platform = serviceEnv.platform ?? process.platform;
    return { done: true, detail: `starting at login is not available on ${platform}; start the sink yourself` };
  }
  if (needsBuild()) {
    return { done: false, detail: "nothing runnable to register as a service; run `npm run build` first" };
  }
  const result = installService({
    ...serviceEnv,
    command: serviceCommand(),
    activateNow: !sinkRunning,
  });
  const detail = result.file !== undefined ? `${result.message} (${result.file})` : result.message;
  return { done: result.ok, detail };
}

/** The lines to print when setup did not run, so the user can finish by hand. */
export function manualSteps(detection: Detection): string[] {
  const steps: string[] = [];
  if (!detection.mcpRegistered) steps.push(mcpAddCommand());
  if (!detection.skillInstalled) steps.push(`${skillInstallCommand()} skill install`);
  if (detection.serviceSupported && !detection.serviceInstalled) {
    steps.push(`${skillInstallCommand()} service install`);
  }
  return steps;
}

/** How to invoke this CLI again, for printed instructions; `npx` by its short name, as a person would type it. */
export function skillInstallCommand(): string {
  const { command, args } = mcpServerCommand();
  const program = basename(command) === "npx" ? "npx" : command;
  return args.length > 1 ? `${program} ${args.slice(0, -1).join(" ")}` : program;
}
