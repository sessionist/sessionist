// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// Tests the login service installer with platform and command runner injected, so nothing here
// writes to the real LaunchAgents directory or shells out to launchctl.

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  installService,
  serviceFile,
  serviceStatus,
  uninstallService,
  type RunCommand,
} from "../src/service/install.js";
import { SERVICE_LABEL, SYSTEMD_UNIT_NAME, launchAgentPlist, systemdUnit } from "../src/service/templates.js";

const COMMAND = { program: "/usr/local/bin/node", args: ["/opt/sessionist/dist/cli.js", "serve"] };

let home: string;
let dataDir: string;
let calls: string[];

/** Records every command and succeeds, unless a failure is scripted by prefix. */
function runner(failOn: string[] = []): RunCommand {
  return (cmd, args) => {
    const line = [cmd, ...args].join(" ");
    calls.push(line);
    return { status: failOn.some((f) => line.startsWith(f)) ? 1 : 0 };
  };
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "sessionist-svc-"));
  dataDir = join(home, ".sessionist");
  calls = [];
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
});

describe("where the unit file goes", () => {
  it("macOS: a LaunchAgent in the user's own library", () => {
    expect(serviceFile({ platform: "darwin", homeDir: home })).toBe(
      join(home, "Library", "LaunchAgents", `${SERVICE_LABEL}.plist`),
    );
  });

  it("Linux: a systemd user unit, never a system one — no sudo, no root", () => {
    const file = serviceFile({ platform: "linux", homeDir: home })!;
    expect(file).toBe(join(home, ".config", "systemd", "user", SYSTEMD_UNIT_NAME));
    expect(file).not.toContain("/etc/");
  });

  it("elsewhere: nothing, rather than a guess", () => {
    expect(serviceFile({ platform: "win32", homeDir: home })).toBeUndefined();
  });
});

describe("the unit files themselves", () => {
  it("relaunch on crash, never after a deliberate stop", () => {
    // KeepAlive:true and Restart=always would both resurrect a service the user stopped on purpose.
    const plist = launchAgentPlist(COMMAND, "/tmp/x.log");
    expect(plist).toContain("<key>SuccessfulExit</key>");
    expect(plist).toContain("<false/>");
    expect(plist).not.toContain("<key>KeepAlive</key>\n  <true/>");

    const unit = systemdUnit(COMMAND);
    expect(unit).toContain("Restart=on-failure");
    expect(unit).not.toContain("Restart=always");
  });

  it("starts at login and names the exact command", () => {
    const plist = launchAgentPlist(COMMAND, "/tmp/x.log");
    expect(plist).toContain("<key>RunAtLoad</key>");
    expect(plist).toContain("<string>/usr/local/bin/node</string>");
    expect(plist).toContain("<string>/opt/sessionist/dist/cli.js</string>");
    expect(systemdUnit(COMMAND)).toContain('ExecStart="/usr/local/bin/node" "/opt/sessionist/dist/cli.js" "serve"');
  });

  it("escapes a path that would otherwise break the file format", () => {
    const nasty = { program: "/opt/a b/node", args: ["/x/<y>&'\"z/cli.js", "serve"] };
    const plist = launchAgentPlist(nasty, "/tmp/l.log");
    expect(plist).toContain("&lt;y&gt;&amp;&apos;&quot;z");
    expect(plist).not.toMatch(/<string>[^<]*<y>/);
    // systemd splits ExecStart on whitespace, so every word is quoted, and % is doubled
    // because systemd expands specifiers.
    expect(systemdUnit({ program: "/a b/node", args: ["100%"] })).toContain('ExecStart="/a b/node" "100%%"');
  });
});

describe("install", () => {
  it("macOS: writes the plist and loads it", () => {
    const result = installService({
      command: COMMAND,
      activateNow: true,
      platform: "darwin",
      homeDir: home,
      dataDir,
      userId: 501,
      runCommand: runner(),
    });
    expect(result.ok).toBe(true);
    expect(existsSync(result.file!)).toBe(true);
    expect(calls).toContain(`launchctl bootstrap gui/501 ${result.file!}`);
    // Unloaded first, so a changed command replaces a loaded one.
    expect(calls.indexOf(`launchctl bootout gui/501/${SERVICE_LABEL}`)).toBeLessThan(
      calls.indexOf(`launchctl bootstrap gui/501 ${result.file!}`),
    );
  });

  it("registers without starting when something already holds the ports", () => {
    // The first-run prompt runs inside a live sink. Starting the service then would
    // bind-fail, and the supervisor would retry that failure forever.
    const result = installService({
      command: COMMAND,
      activateNow: false,
      platform: "darwin",
      homeDir: home,
      dataDir,
      runCommand: runner(),
    });
    expect(result.ok).toBe(true);
    expect(result.deferred).toBe(true);
    expect(result.message).toContain("next login");
    expect(calls.some((c) => c.startsWith("launchctl bootstrap"))).toBe(false);
  });

  it("Linux: enables the unit and turns on lingering so a headless box survives logout", () => {
    const result = installService({
      command: COMMAND,
      activateNow: true,
      platform: "linux",
      homeDir: home,
      dataDir,
      runCommand: runner(),
    });
    expect(result.ok).toBe(true);
    expect(calls).toContain("systemctl --user daemon-reload");
    expect(calls).toContain(`systemctl --user enable --now ${SYSTEMD_UNIT_NAME}`);
    expect(calls.some((c) => c.startsWith("loginctl enable-linger"))).toBe(true);
    expect(result.message).toContain("lingering enabled");
  });

  it("Linux: --no-linger leaves it off and says what that costs", () => {
    installService({
      command: COMMAND,
      activateNow: true,
      platform: "linux",
      homeDir: home,
      dataDir,
      linger: false,
      runCommand: runner(),
    });
    expect(calls.some((c) => c.startsWith("loginctl"))).toBe(false);
  });

  it("Linux: says so when systemd user services are unavailable, and writes nothing", () => {
    const result = installService({
      command: COMMAND,
      activateNow: true,
      platform: "linux",
      homeDir: home,
      dataDir,
      runCommand: runner(["systemctl --user --version"]),
    });
    expect(result.ok).toBe(false);
    expect(result.skipped).toBe(true);
    expect(result.message).toContain("WSL");
    expect(existsSync(serviceFile({ platform: "linux", homeDir: home })!)).toBe(false);
  });

  it("Windows: refuses honestly and tells the user what to do instead", () => {
    const result = installService({
      command: COMMAND,
      activateNow: true,
      platform: "win32",
      homeDir: home,
      dataDir,
      runCommand: runner(),
    });
    expect(result.ok).toBe(false);
    expect(result.skipped).toBe(true);
    expect(result.message).toContain("not supported on win32");
  });

  it("keeps the printed command when the supervisor refuses to load it", () => {
    const result = installService({
      command: COMMAND,
      activateNow: true,
      platform: "darwin",
      homeDir: home,
      dataDir,
      userId: 7,
      runCommand: runner(["launchctl bootstrap"]),
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("launchctl bootstrap gui/7");
    // The file is still there, so the user can load it by hand.
    expect(existsSync(result.file!)).toBe(true);
  });

  it("does not rewrite an identical file, so a re-run triggers no reload", () => {
    const opts = {
      command: COMMAND,
      activateNow: false,
      platform: "darwin" as NodeJS.Platform,
      homeDir: home,
      dataDir,
      runCommand: runner(),
    };
    const first = installService(opts);
    const before = readFileSync(first.file!, "utf8");
    const second = installService(opts);
    expect(readFileSync(second.file!, "utf8")).toBe(before);
    expect(second.message).toContain("already installed");
  });
});

describe("status", () => {
  it("reports not installed before anything is written", () => {
    const status = serviceStatus({ platform: "darwin", homeDir: home, dataDir, runCommand: runner() });
    expect(status.supported).toBe(true);
    expect(status.installed).toBe(false);
  });

  it("reads back the command and notices when it has gone missing", () => {
    installService({
      command: COMMAND,
      activateNow: false,
      platform: "darwin",
      homeDir: home,
      dataDir,
      runCommand: runner(),
    });
    const status = serviceStatus({ platform: "darwin", homeDir: home, dataDir, runCommand: runner() });
    expect(status.installed).toBe(true);
    expect(status.command).toBe(COMMAND.program);
    // A moved checkout leaves a service that fails on every retry; status must say so.
    expect(status.commandExists).toBe(false);
  });

  it("reads the command back out of a systemd unit too", () => {
    installService({
      command: COMMAND,
      activateNow: false,
      platform: "linux",
      homeDir: home,
      dataDir,
      runCommand: runner(),
    });
    const status = serviceStatus({ platform: "linux", homeDir: home, dataDir, runCommand: runner() });
    expect(status.command).toBe(COMMAND.program);
  });

  it("separates loaded from installed", () => {
    installService({
      command: COMMAND,
      activateNow: false,
      platform: "darwin",
      homeDir: home,
      dataDir,
      runCommand: runner(),
    });
    const notLoaded = serviceStatus({
      platform: "darwin",
      homeDir: home,
      dataDir,
      runCommand: runner(["launchctl print"]),
    });
    expect(notLoaded.installed).toBe(true);
    expect(notLoaded.loaded).toBe(false);
  });

  it("reports the log size, since nothing rotates it", () => {
    installService({
      command: COMMAND,
      activateNow: false,
      platform: "darwin",
      homeDir: home,
      dataDir,
      runCommand: runner(),
    });
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(join(dataDir, "service.log"), "x".repeat(1234));
    const status = serviceStatus({ platform: "darwin", homeDir: home, dataDir, runCommand: runner() });
    expect(status.logBytes).toBe(1234);
  });
});

describe("uninstall", () => {
  it("removes the file and the registration", () => {
    const installed = installService({
      command: COMMAND,
      activateNow: false,
      platform: "darwin",
      homeDir: home,
      dataDir,
      userId: 501,
      runCommand: runner(),
    });
    calls = [];
    const result = uninstallService({ platform: "darwin", homeDir: home, dataDir, userId: 501, runCommand: runner() });
    expect(result.ok).toBe(true);
    expect(existsSync(installed.file!)).toBe(false);
    expect(calls).toContain(`launchctl bootout gui/501/${SERVICE_LABEL}`);
  });

  it("Linux: disables, removes, and reloads", () => {
    installService({
      command: COMMAND,
      activateNow: false,
      platform: "linux",
      homeDir: home,
      dataDir,
      runCommand: runner(),
    });
    calls = [];
    uninstallService({ platform: "linux", homeDir: home, dataDir, runCommand: runner() });
    expect(calls).toContain(`systemctl --user disable --now ${SYSTEMD_UNIT_NAME}`);
    expect(calls).toContain("systemctl --user daemon-reload");
  });

  it("is a no-op when it was never installed", () => {
    const result = uninstallService({ platform: "darwin", homeDir: home, dataDir, runCommand: runner() });
    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(true);
    expect(calls).toEqual([]);
  });
});
