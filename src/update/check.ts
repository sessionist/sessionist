// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// The one outbound request the sink makes: a read-only look at the npm registry for the newest published
// version, at most once a day, off by config or --offline; and the health block saying what it found and
// whether this sink can restart onto it.

import { readFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join } from "node:path";
import { allowOutbound, isOffline } from "../cli/egress.js";
import { compareVersions, packageVersion } from "../cli/version.js";
import { loadConfig, saveConfigValue, type SessionistConfig } from "../config.js";
import { serviceStatus, type ServiceStatus } from "../service/install.js";

export const REGISTRY_HOST = "registry.npmjs.org";
const REGISTRY_URL = `https://${REGISTRY_HOST}/sessionist/latest`;
export const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 5_000;

/** The shape of fetch this module needs; injected by tests so no request leaves. */
export type Fetcher = (
  url: string,
  init: { signal: AbortSignal },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/** A check is due when checks are on, --offline is not set, and the last attempt is a day old or absent. A
 *  failed attempt counts as an attempt, so a registry outage costs one request a day, not one an hour. */
export function checkDue(config: Pick<SessionistConfig, "updateCheck" | "updateCheckedAt">, now = Date.now()): boolean {
  if (!config.updateCheck || isOffline()) return false;
  if (config.updateCheckedAt === undefined) return true;
  const last = Date.parse(config.updateCheckedAt);
  return Number.isNaN(last) || now - last >= CHECK_INTERVAL_MS;
}

/** One GET, no body, no custom headers; the answer is written to config so a restart does not ask again.
 *  Failure goes to stderr (the service log) and is otherwise silent. */
export async function checkForUpdate(fetcher: Fetcher = fetch as unknown as Fetcher, now = Date.now()): Promise<string | undefined> {
  let latest: string | undefined;
  try {
    latest = await allowOutbound(REGISTRY_HOST, async () => {
      const response = await fetcher(REGISTRY_URL, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (!response.ok) throw new Error(`registry answered ${String(response.status)}`);
      const body = (await response.json()) as { version?: unknown };
      if (typeof body.version !== "string") throw new Error("registry answer carried no version");
      return body.version;
    });
    saveConfigValue("updateLatest", latest);
  } catch (err) {
    console.error(`[update] check failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  saveConfigValue("updateCheckedAt", new Date(now).toISOString());
  return latest;
}

/** Runs a due check now and looks again every hour; the day-long gate is in checkDue, so a config change
 *  applies at the next look and a successful check is never repeated within a day. */
export function scheduleUpdateChecks(fetcher?: Fetcher): void {
  const look = (): void => {
    if (checkDue(loadConfig())) void checkForUpdate(fetcher);
  };
  look();
  setInterval(look, 60 * 60 * 1000).unref();
}

export type SelfUpdate =
  | { canSelfUpdate: true; onDisk?: string }
  | { canSelfUpdate: false; reason: "no-service" | "fixed-path" | "unsupported"; command: string };

/** Whether restarting the login service would start newer code: yes from the npx cache, which re-resolves the
 *  package on every start; yes from a fixed path when the package on disk beside the entry the unit runs is
 *  newer than this process (a global install after `npm i -g`, a checkout after a build); otherwise no, with
 *  the command that puts new code on disk. */
export function selfUpdateAbility(status: ServiceStatus = serviceStatus(), running = packageVersion()): SelfUpdate {
  if (!status.supported) {
    return { canSelfUpdate: false, reason: "unsupported", command: "stop the sink and start `npx sessionist` again" };
  }
  if (!status.installed) {
    return {
      canSelfUpdate: false,
      reason: "no-service",
      command: "stop this sink and start `npx sessionist` again, or run `npx sessionist service install`",
    };
  }
  if (status.command === undefined || basename(status.command) !== "npx") {
    const onDisk = installedVersion(status.args ?? []);
    if (onDisk !== undefined && compareVersions(onDisk, running) > 0) return { canSelfUpdate: true, onDisk };
    return { canSelfUpdate: false, reason: "fixed-path", command: "npm i -g sessionist@latest, then sessionist update" };
  }
  return { canSelfUpdate: true };
}

/** The version of the sessionist package the unit's entry script belongs to: the nearest package.json named
 *  `sessionist` above the first absolute script path in the arguments. Undefined when there is none. */
export function installedVersion(args: readonly string[]): string | undefined {
  const entry = args.find((a) => isAbsolute(a) && a.endsWith(".js"));
  if (entry === undefined) return undefined;
  let dir = dirname(entry);
  for (let depth = 0; depth < 4; depth++) {
    try {
      const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as { name?: unknown; version?: unknown };
      if (pkg.name === "sessionist" && typeof pkg.version === "string") return pkg.version;
    } catch {
      // not here; look one level up
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

export type UpdateBlock =
  | { checksEnabled: false; reason: "config" | "offline" }
  | ({ checksEnabled: true; checkedAt?: string; latest?: string; available?: boolean } & SelfUpdate);

/** What /api/health reports. Fields absent until a check has succeeded are absent, never guessed. */
export function updateBlock(
  config: Pick<SessionistConfig, "updateCheck" | "updateCheckedAt" | "updateLatest">,
  running: string,
  ability: SelfUpdate,
): UpdateBlock {
  if (isOffline()) return { checksEnabled: false, reason: "offline" };
  if (!config.updateCheck) return { checksEnabled: false, reason: "config" };
  const block: UpdateBlock = { checksEnabled: true, ...ability };
  if (config.updateCheckedAt !== undefined) block.checkedAt = config.updateCheckedAt;
  if (config.updateLatest !== undefined) {
    block.latest = config.updateLatest;
    block.available = compareVersions(config.updateLatest, running) > 0;
  }
  return block;
}
