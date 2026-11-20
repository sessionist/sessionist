// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// Install, remove, and inspect the login service that keeps the sink listening.

import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { homedir, userInfo } from "node:os";
import { join } from "node:path";
import { launchAgentPlist, systemdUnit, SERVICE_LABEL, SYSTEMD_UNIT_NAME, type ServiceCommand } from "./templates.js";

export type RunCommand = (cmd: string, args: string[]) => { status: number | null; error?: unknown };

export interface ServiceEnv {
  platform?: NodeJS.Platform;
  homeDir?: string;
  dataDir?: string;
  runCommand?: RunCommand;
  userId?: number;
}

export interface InstallOptions extends ServiceEnv {
  command: ServiceCommand;
  /** Start it immediately. False when something already holds the ports. */
  activateNow: boolean;
  /** Linux: keep the user service running after the last session ends. */
  linger?: boolean;
}

export interface ServiceResult {
  ok: boolean;
  skipped?: boolean;
  message: string;
  file?: string;
  /** Written and registered, but not started: it takes over at the next login. */
  deferred?: boolean;
}

function defaultRun(cmd: string, args: string[]): { status: number | null; error?: unknown } {
  const result = spawnSync(cmd, args, { stdio: "ignore", timeout: 20_000 });
  return { status: result.status, error: result.error };
}

/** Skip an identical write so a re-run does not churn the file or trigger a reload. */
function writeIfChanged(file: string, content: string): boolean {
  try {
    if (readFileSync(file, "utf8") === content) return false;
  } catch {
    // Absent or unreadable: write it.
  }
  mkdirSync(join(file, ".."), { recursive: true });
  writeFileSync(file, content);
  return true;
}

function env(opts: ServiceEnv): Required<Omit<ServiceEnv, "userId">> & { userId: number } {
  const home = opts.homeDir ?? homedir();
  return {
    platform: opts.platform ?? process.platform,
    homeDir: home,
    dataDir: opts.dataDir ?? join(home, ".sessionist"),
    runCommand: opts.runCommand ?? defaultRun,
    userId: opts.userId ?? userInfo().uid,
  };
}

/** Where the unit file goes, or undefined on a platform we do not support. */
export function serviceFile(opts: ServiceEnv = {}): string | undefined {
  const e = env(opts);
  if (e.platform === "darwin") return join(e.homeDir, "Library", "LaunchAgents", `${SERVICE_LABEL}.plist`);
  if (e.platform === "linux") return join(e.homeDir, ".config", "systemd", "user", SYSTEMD_UNIT_NAME);
  return undefined;
}

export function serviceLogPath(opts: ServiceEnv = {}): string {
  return join(env(opts).dataDir, "service.log");
}

export function installService(opts: InstallOptions): ServiceResult {
  const e = env(opts);
  const file = serviceFile(opts);
  if (file === undefined) {
    return {
      ok: false,
      skipped: true,
      message: `starting at login is not supported on ${e.platform}; start the sink yourself with \`sessionist\``,
    };
  }

  if (e.platform === "darwin") {
    mkdirSync(e.dataDir, { recursive: true });
    const changed = writeIfChanged(file, launchAgentPlist(opts.command, serviceLogPath(opts)));
    if (!opts.activateNow) {
      // Registered but not started: something is already holding the ports.
      return {
        ok: true,
        deferred: true,
        file,
        message: changed
          ? "installed; the sink will start at your next login"
          : "already installed; the sink will start at your next login",
      };
    }
    // bootout first so a changed command replaces a loaded one; a not-loaded service
    // makes this a harmless no-op.
    e.runCommand("launchctl", ["bootout", `gui/${String(e.userId)}/${SERVICE_LABEL}`]);
    const load = e.runCommand("launchctl", ["bootstrap", `gui/${String(e.userId)}`, file]);
    if (load.status !== 0) {
      return {
        ok: false,
        file,
        message: `wrote ${file} but launchctl could not load it; run: launchctl bootstrap gui/${String(e.userId)} ${file}`,
      };
    }
    return { ok: true, file, message: "installed and started; it will start at login from now on" };
  }

  // linux
  const probe = e.runCommand("systemctl", ["--user", "--version"]);
  if (probe.status !== 0) {
    return {
      ok: false,
      skipped: true,
      message: "systemd user services are not available here (a container, or WSL without systemd)",
    };
  }
  mkdirSync(e.dataDir, { recursive: true });
  writeIfChanged(file, systemdUnit(opts.command));
  const reload = e.runCommand("systemctl", ["--user", "daemon-reload"]);
  if (reload.status !== 0) return { ok: false, file, message: "could not reload systemd user units" };

  const enableArgs = opts.activateNow
    ? ["--user", "enable", "--now", SYSTEMD_UNIT_NAME]
    : ["--user", "enable", SYSTEMD_UNIT_NAME];
  const enable = e.runCommand("systemctl", enableArgs);
  if (enable.status !== 0) return { ok: false, file, message: `could not enable ${SYSTEMD_UNIT_NAME}` };

  // A systemd user service stops when the user's last session ends unless lingering is enabled.
  let lingerNote = "";
  if (opts.linger !== false) {
    const linger = e.runCommand("loginctl", ["enable-linger", userInfo().username]);
    lingerNote =
      linger.status === 0
        ? "; lingering enabled, so it keeps running when you log out"
        : "; could not enable lingering, so it will stop when your last session ends (run: loginctl enable-linger $USER)";
  }

  const result: ServiceResult = {
    ok: true,
    file,
    message: opts.activateNow
      ? `installed and started; it will start at login from now on${lingerNote}`
      : `installed; the sink will start at your next login${lingerNote}`,
  };
  if (!opts.activateNow) result.deferred = true;
  return result;
}

export function uninstallService(opts: ServiceEnv = {}): ServiceResult {
  const e = env(opts);
  const file = serviceFile(opts);
  if (file === undefined) {
    return { ok: true, skipped: true, message: `nothing to remove on ${e.platform}` };
  }
  if (!existsSync(file)) {
    return { ok: true, skipped: true, message: "not installed", file };
  }

  if (e.platform === "darwin") {
    e.runCommand("launchctl", ["bootout", `gui/${String(e.userId)}/${SERVICE_LABEL}`]);
  } else {
    e.runCommand("systemctl", ["--user", "disable", "--now", SYSTEMD_UNIT_NAME]);
  }
  rmSync(file, { force: true });
  if (e.platform === "linux") e.runCommand("systemctl", ["--user", "daemon-reload"]);
  return { ok: true, file, message: "removed; the sink no longer starts at login" };
}

export interface ServiceStatus {
  supported: boolean;
  platform: NodeJS.Platform;
  installed: boolean;
  file?: string;
  /** The supervisor has it loaded. Separate from whether the port is accepting. */
  loaded?: boolean;
  /** The command in the unit file still exists on disk. */
  commandExists?: boolean;
  command?: string;
  logPath?: string;
  logBytes?: number;
}

export function serviceStatus(opts: ServiceEnv = {}): ServiceStatus {
  const e = env(opts);
  const file = serviceFile(opts);
  if (file === undefined) return { supported: false, platform: e.platform, installed: false };

  const status: ServiceStatus = { supported: true, platform: e.platform, installed: existsSync(file), file };
  if (!status.installed) return status;

  const content = readFileSync(file, "utf8");
  const command = e.platform === "darwin" ? firstPlistArg(content) : execStartPath(content);
  if (command !== undefined) {
    status.command = command;
    status.commandExists = existsSync(command);
  }

  const probe =
    e.platform === "darwin"
      ? e.runCommand("launchctl", ["print", `gui/${String(e.userId)}/${SERVICE_LABEL}`])
      : e.runCommand("systemctl", ["--user", "is-enabled", SYSTEMD_UNIT_NAME]);
  status.loaded = probe.status === 0;

  const log = serviceLogPath(opts);
  if (existsSync(log)) {
    status.logPath = log;
    status.logBytes = statSync(log).size;
  }
  return status;
}

/** The program a plist would run, for the "does it still exist?" check. */
function firstPlistArg(plist: string): string | undefined {
  const array = /<key>ProgramArguments<\/key>\s*<array>([\s\S]*?)<\/array>/.exec(plist);
  if (array === null) return undefined;
  const first = /<string>([\s\S]*?)<\/string>/.exec(array[1]!);
  return first?.[1];
}

function execStartPath(unit: string): string | undefined {
  const line = /^ExecStart=(.*)$/m.exec(unit);
  if (line === null) return undefined;
  const quoted = /^"((?:[^"\\]|\\.)*)"/.exec(line[1]!.trim());
  const raw = quoted !== null ? quoted[1]! : line[1]!.trim().split(/\s+/)[0]!;
  return raw.replace(/\\(.)/g, "$1");
}
