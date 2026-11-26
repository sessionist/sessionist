// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// Refuses any connection from this process to an address that is not this machine, at the one place every
// outbound socket passes through; a command that must reach out lifts the guard for one host and one call,
// and --offline forbids even that.

import { Socket } from "node:net";

export const EGRESS_REFUSED = "ESESSIONIST_EGRESS";

let installed = false;
let offline = false;
/** Hosts a command has been granted, with how many grants are open on each. */
const grants = new Map<string, number>();

export function isLoopbackHost(host: string | undefined): boolean {
  if (host === undefined || host === "") return true; // Node connects to localhost when no host is given
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  return h === "localhost" || h === "::1" || h === "::ffff:127.0.0.1" || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h);
}

export function isAllowedHost(host: string | undefined): boolean {
  return isLoopbackHost(host) || (host !== undefined && grants.has(host.toLowerCase()));
}

/** Where a connect() call is going: a host, or undefined for a Unix socket path, which never leaves the machine.
 *  net.connect() hands the prototype its arguments pre-normalized as an array; unwrap that first. */
function targetHost(args: unknown[]): string | undefined {
  let first = args[0];
  if (Array.isArray(first)) first = (first as unknown[])[0];
  if (typeof first === "string") return undefined;
  if (typeof first === "number") return typeof args[1] === "string" ? args[1] : "localhost";
  if (first !== null && typeof first === "object") {
    const options = first as { path?: unknown; host?: unknown };
    if (typeof options.path === "string") return undefined;
    return typeof options.host === "string" ? options.host : "localhost";
  }
  return "localhost";
}

function refusal(host: string): NodeJS.ErrnoException {
  return Object.assign(new Error(`sessionist refuses outbound connections: ${host} is not this machine`), {
    code: EGRESS_REFUSED,
  });
}

/** Patch once, before any module that could open a socket runs. The check happens before the name is
 *  looked up, so a refused host is never even resolved. */
export function installEgressGuard(): void {
  if (installed) return;
  installed = true;
  type Connect = (this: Socket, ...args: unknown[]) => Socket;
  const original = Socket.prototype.connect as unknown as Connect;
  const guarded: Connect = function guarded(this: Socket, ...args: unknown[]): Socket {
    const host = targetHost(args);
    if (host !== undefined && !isAllowedHost(host)) {
      // Fail the way a refused connection fails: an error event on the socket, not a throw mid-setup.
      process.nextTick(() => this.destroy(refusal(host)));
      return this;
    }
    return original.apply(this, args);
  };
  (Socket.prototype as unknown as { connect: Connect }).connect = guarded;
}

export function setOffline(on = true): void {
  offline = on;
}

export function isOffline(): boolean {
  return offline;
}

/** For a command that reaches out on purpose: one host, for the duration of `fn`. Refused under --offline. */
export async function allowOutbound<T>(host: string, fn: () => Promise<T>): Promise<T> {
  if (offline) {
    throw Object.assign(new Error(`--offline: ${host} is not reached`), { code: EGRESS_REFUSED });
  }
  const key = host.toLowerCase();
  grants.set(key, (grants.get(key) ?? 0) + 1);
  try {
    return await fn();
  } finally {
    const open = (grants.get(key) ?? 1) - 1;
    if (open <= 0) grants.delete(key);
    else grants.set(key, open);
  }
}
