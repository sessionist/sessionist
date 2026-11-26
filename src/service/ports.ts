// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// Who is listening on a local TCP port, by PID and command, asked of the system's own tools; undefined when nobody is, or when nothing here can tell.

import { spawnSync } from "node:child_process";

export interface PortHolder {
  pid: number;
  command?: string;
}

/** Runs a command and returns its exit status and stdout; null status means it could not be started. */
export type Capture = (cmd: string, args: string[]) => { status: number | null; stdout: string };

const PROBE_TIMEOUT_MS = 5_000;

const defaultCapture: Capture = (cmd, args) => {
  const result = spawnSync(cmd, args, {
    encoding: "utf8",
    timeout: PROBE_TIMEOUT_MS,
    stdio: ["ignore", "pipe", "ignore"],
  });
  return { status: result.error !== undefined ? null : result.status, stdout: result.stdout ?? "" };
};

export function portHolder(port: number, capture: Capture = defaultCapture): PortHolder | undefined {
  const pid = listeningPid(port, capture);
  if (pid === undefined) return undefined;
  const ps = capture("ps", ["-o", "args=", "-p", String(pid)]);
  const command = ps.status === 0 ? ps.stdout.trim() : "";
  return command === "" ? { pid } : { pid, command };
}

function listeningPid(port: number, capture: Capture): number | undefined {
  // lsof prints one PID per line with -t, and exits non-zero when nothing matches.
  const lsof = capture("lsof", ["-nP", "-t", `-iTCP:${String(port)}`, "-sTCP:LISTEN"]);
  if (lsof.status === 0) {
    const pid = Number(lsof.stdout.trim().split("\n")[0]);
    if (Number.isInteger(pid) && pid > 0) return pid;
  }
  // Linux without lsof: ss prints users:(("node",pid=1234,fd=16)).
  const ss = capture("ss", ["-ltnpH", `sport = :${String(port)}`]);
  if (ss.status === 0) {
    const match = /pid=(\d+)/.exec(ss.stdout);
    if (match !== null) return Number(match[1]);
  }
  return undefined;
}

/** One clause a person can act on. */
export function describeHolder(port: number, holder: PortHolder | undefined): string {
  if (holder === undefined) return `port ${String(port)} is in use by a process this machine's tools could not name`;
  const pid = `PID ${String(holder.pid)}`;
  return holder.command === undefined
    ? `port ${String(port)} is held by ${pid}`
    : `port ${String(port)} is held by ${pid} (${holder.command})`;
}
