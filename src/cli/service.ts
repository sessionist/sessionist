// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// `sessionist service`: keep the sink listening across logins via launchd or systemd --user.

import { loadConfig } from "../config.js";
import { findOccupancy, occupancyDetail, serviceCommand, skillInstallCommand } from "../setup/apply.js";
import { installService, serviceLogPath, serviceStatus, uninstallService, type ServiceResult } from "../service/install.js";
import { describeHolder, portHolder } from "../service/ports.js";

/** How long a freshly started service gets to answer before its start is reported as unverified. */
export const START_WAIT_MS = 5_000;

export const USAGE = `usage: sessionist service <install|uninstall|status> [--no-linger]

  install    start the sink at login (launchd on macOS, systemd --user on Linux)
  uninstall  remove it; the sink then runs only when you start it
  status     where the unit file is, whether it is loaded, whether the port answers

  --no-linger  Linux only: do not run \`loginctl enable-linger\`. Without lingering a
               user service stops when your last session ends, which on a headless
               machine means the sink dies when you log out.`;

export interface SinkHealth {
  version: string;
  uptimeMs: number;
  /** Absent when the sink predates reporting it. */
  pid?: number;
}

/** What answers on the Query API port, or undefined when nothing does. */
export async function sinkHealth(apiPort: number): Promise<SinkHealth | undefined> {
  try {
    const response = await fetch(`http://127.0.0.1:${String(apiPort)}/api/health`, {
      signal: AbortSignal.timeout(1500),
    });
    if (!response.ok) return undefined;
    const body = (await response.json()) as { version?: unknown; uptimeMs?: unknown; pid?: unknown };
    const health: SinkHealth = {
      version: typeof body.version === "string" ? body.version : "unknown",
      uptimeMs: typeof body.uptimeMs === "number" ? body.uptimeMs : 0,
    };
    if (typeof body.pid === "number") health.pid = body.pid;
    return health;
  } catch {
    return undefined;
  }
}

/** Whether something already answers on the Query API port. */
export async function isSinkListening(apiPort: number): Promise<boolean> {
  return (await sinkHealth(apiPort)) !== undefined;
}

/** Wait for a sink that was just started to answer; an answer with an uptime longer than the wait is the old
 *  process still going, not the new one. */
export async function waitForSink(apiPort: number, timeoutMs: number): Promise<SinkHealth | undefined> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const health = await sinkHealth(apiPort);
    if (health !== undefined && health.uptimeMs < timeoutMs) return health;
    await new Promise((r) => setTimeout(r, 250));
  }
  return sinkHealth(apiPort);
}

/** "on port 4319, version 0.1.3, PID 912"; the PID only when the sink reports one. */
export function describeListening(health: SinkHealth, apiPort: number): string {
  const pid = health.pid !== undefined ? `, PID ${String(health.pid)}` : "";
  return `on port ${String(apiPort)}, version ${health.version}${pid}`;
}

/** The line after a service was told to start: what answered, or that nothing did and where to look. */
export function describeStart(started: SinkHealth | undefined, apiPort: number): string {
  return started !== undefined
    ? `listening ${describeListening(started, apiPort)}`
    : `loaded, but nothing answers on port ${String(apiPort)} after ${String(START_WAIT_MS / 1000)} s; check ${serviceLogPath()}`;
}

function report(result: ServiceResult): void {
  console.log(`${result.ok ? "✓" : "!"} ${result.message}`);
  if (result.file !== undefined) console.log(`  ${result.file}`);
  if (!result.ok) process.exitCode = 1;
}

export async function service(subcommand: string | undefined, argv: string[], jsonOutput: boolean): Promise<void> {
  const config = loadConfig();

  switch (subcommand) {
    case "install": {
      // Never hand the supervisor a port that is already held: it would bind-fail and be retried forever.
      const occupied = findOccupancy(config.otlpPort, config.apiPort, await sinkHealth(config.apiPort));
      const result = installService({
        command: serviceCommand(),
        activateNow: occupied === false,
        linger: !argv.includes("--no-linger"),
      });
      // A success message that does not check its own outcome is the worst kind.
      const started = result.ok && occupied === false ? await waitForSink(config.apiPort, START_WAIT_MS) : undefined;
      if (jsonOutput) {
        console.log(JSON.stringify({ ...result, occupied: occupied === false ? null : occupied, started: started ?? null }));
      } else {
        report(result);
        if (occupied !== false) console.log(`  ${occupancyDetail(occupied, skillInstallCommand())}`);
        else if (result.ok) console.log(`  ${started !== undefined ? "✓" : "!"} ${describeStart(started, config.apiPort)}`);
      }
      if (result.ok && occupied === false && started === undefined) process.exitCode = 1;
      return;
    }
    case "uninstall": {
      const result = uninstallService();
      if (jsonOutput) console.log(JSON.stringify(result));
      else report(result);
      return;
    }
    case "status": {
      const status = serviceStatus();
      const health = await sinkHealth(config.apiPort);
      const listening = health !== undefined;
      // When nothing of ours answers, say who does hold the ports, if anyone.
      const holders = listening
        ? []
        : [config.otlpPort, config.apiPort]
            .map((port) => ({ port, holder: portHolder(port) }))
            .filter((h) => h.holder !== undefined);
      if (jsonOutput) {
        console.log(JSON.stringify({ ...status, listening, sink: health ?? null, portsHeld: holders }));
        return;
      }
      if (!status.supported) {
        console.log(`starting at login is not supported on ${status.platform}`);
        console.log(`the sink runs only while you have \`sessionist\` open; it is ${listening ? "up" : "not running"}`);
        return;
      }
      console.log(`installed    ${status.installed ? "yes" : "no"}`);
      if (status.file !== undefined) console.log(`unit file    ${status.file}`);
      if (status.installed) {
        console.log(`loaded       ${status.loaded === true ? "yes" : "no"}`);
        if (status.command !== undefined) {
          console.log(`runs         ${status.command}${status.commandExists === false ? "  (MISSING — reinstall)" : ""}`);
        }
        if (status.logPath !== undefined) {
          console.log(`log          ${status.logPath}  (${String(status.logBytes ?? 0)} bytes, never rotated)`);
        }
      }
      console.log(`listening    ${health !== undefined ? `yes, ${describeListening(health, config.apiPort)}` : "no"}`);
      for (const h of holders) console.log(`             ${describeHolder(h.port, h.holder)}`);
      return;
    }
    default:
      console.error(USAGE);
      process.exitCode = 1;
  }
}
