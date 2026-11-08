// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// What is already attached to this machine's coding agent; every check is local and cheap (`claude mcp get` answers only about our server, where `claude mcp list` probes every one).

import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { SKILL_NAME, findSkillFile, userSkillsRoot } from "../cli/skill.js";
import { serviceFile, serviceStatus, type ServiceEnv } from "../service/install.js";

/** The name the server is registered under, and the command that starts it. */
export const MCP_SERVER_NAME = "sessionist";

const PROBE_TIMEOUT_MS = 5_000;

export interface Detection {
  /** The Claude Code CLI is on PATH, so registration can be automated. */
  claudeCli: boolean;
  /** Our MCP server is already registered with Claude Code. */
  mcpRegistered: boolean;
  /** The shipped skill is installed and its bytes match what ships here. */
  skillInstalled: boolean;
  /** The login service is installed, so capture survives a reboot. */
  serviceInstalled: boolean;
  /** This platform can start the sink at login at all. */
  serviceSupported: boolean;
  /** Set when a check could not be made rather than answered. */
  note?: string;
}

export function hasClaudeCli(): boolean {
  const probe = spawnSync("claude", ["--version"], { stdio: "ignore", timeout: PROBE_TIMEOUT_MS });
  return probe.error === undefined && probe.status === 0;
}

/** `claude mcp get` exits non-zero when the server is absent. */
export function isMcpRegistered(): boolean {
  const probe = spawnSync("claude", ["mcp", "get", MCP_SERVER_NAME], {
    stdio: "ignore",
    timeout: PROBE_TIMEOUT_MS,
  });
  return probe.error === undefined && probe.status === 0;
}

/** An edited or stale copy counts as not installed, so setup refreshes it. */
export function isSkillInstalled(skillsRoot: string = userSkillsRoot()): boolean {
  const target = join(skillsRoot, SKILL_NAME, "SKILL.md");
  if (!existsSync(target)) return false;
  const source = findSkillFile();
  if (source === undefined) return false;
  try {
    return readFileSync(target, "utf8") === readFileSync(source, "utf8");
  } catch {
    return false;
  }
}

/** `serviceEnv` lets tests point the service checks at a temp home. */
export function detect(skillsRoot: string = userSkillsRoot(), serviceEnv: ServiceEnv = {}): Detection {
  const claudeCli = hasClaudeCli();
  const supported = serviceFile(serviceEnv) !== undefined;
  const result: Detection = {
    claudeCli,
    mcpRegistered: claudeCli ? isMcpRegistered() : false,
    skillInstalled: isSkillInstalled(skillsRoot),
    serviceSupported: supported,
    serviceInstalled: supported ? serviceStatus(serviceEnv).installed : false,
  };
  if (!claudeCli) {
    result.note = "the claude CLI is not on PATH, so MCP registration cannot be automated here";
  }
  return result;
}

/** A platform with no service mechanism counts as satisfied rather than permanently missing. */
export function isFullyAttached(d: Detection): boolean {
  return d.mcpRegistered && d.skillInstalled && (d.serviceInstalled || !d.serviceSupported);
}
