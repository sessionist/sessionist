// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// `sessionist service`: keep the sink listening across logins via launchd or systemd --user.

import { loadConfig } from "../config.js";
import { serviceCommand } from "../setup/apply.js";
import { installService, serviceStatus, uninstallService, type ServiceResult } from "../service/install.js";

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
}

/** What answers on the Query API port, or undefined when nothing does. */
export async function sinkHealth(apiPort: number): Promise<SinkHealth | undefined> {
  try {
    const response = await fetch(`http://127.0.0.1:${String(apiPort)}/api/health`, {
      signal: AbortSignal.timeout(1500),
    });
    if (!response.ok) return undefined;
    const body = (await response.json()) as { version?: unknown; uptimeMs?: unknown };
    return {
      version: typeof body.version === "string" ? body.version : "unknown",
      uptimeMs: typeof body.uptimeMs === "number" ? body.uptimeMs : 0,
    };
  } catch {
    return undefined;
  }
}

/** Whether something already answers on the Query API port. */
export async function isSinkListening(apiPort: number): Promise<boolean> {
  return (await sinkHealth(apiPort)) !== undefined;
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
      const running = await isSinkListening(config.apiPort);
      const result = installService({
        command: serviceCommand(),
        activateNow: !running,
        linger: !argv.includes("--no-linger"),
      });
      if (jsonOutput) console.log(JSON.stringify({ ...result, sinkWasRunning: running }));
      else {
        report(result);
        if (running && result.ok) {
          console.log("  (the sink is already running in another terminal; the service takes over after it stops)");
        }
      }
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
      const listening = await isSinkListening(config.apiPort);
      if (jsonOutput) {
        console.log(JSON.stringify({ ...status, listening }));
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
      console.log(`listening    ${listening ? `yes, on port ${String(config.apiPort)}` : "no"}`);
      return;
    }
    default:
      console.error(USAGE);
      process.exitCode = 1;
  }
}
