// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// The launchd and systemd unit files as pure functions of the command to run; both relaunch only on failure, so a deliberate stop stays stopped.

export const SERVICE_LABEL = "ai.sessionist.sink";
export const SYSTEMD_UNIT_NAME = "sessionist.service";

export interface ServiceCommand {
  program: string;
  args: string[];
}

function xml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** systemd splits ExecStart on whitespace, so every word is quoted, backslashes and
 *  quotes escaped, and `%` doubled because systemd expands specifiers. */
function systemdQuote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/%/g, "%%")}"`;
}

export function launchAgentPlist(command: ServiceCommand, logPath: string): string {
  const args = [command.program, ...command.args].map((a) => `    <string>${xml(a)}</string>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${SERVICE_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
${args}
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
  </dict>
  <key>StandardOutPath</key>
  <string>${xml(logPath)}</string>
  <key>StandardErrorPath</key>
  <string>${xml(logPath)}</string>
</dict>
</plist>
`;
}

export function systemdUnit(command: ServiceCommand): string {
  const execStart = [command.program, ...command.args].map(systemdQuote).join(" ");
  return `[Unit]
Description=Sessionist (local OpenTelemetry sink)
Documentation=https://github.com/sessionist/sessionist

[Service]
ExecStart=${execStart}
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
`;
}
