// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// `sessionist update`: start the sink again on the installed version and refresh the installed skill; nothing here fetches anything.

import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import { loadConfig } from "../config.js";
import { restartService, serviceStatus } from "../service/install.js";
import { cliInvocation } from "../setup/apply.js";
import { sinkHealth, waitForSink, type SinkHealth } from "./service.js";
import { installSkill, userSkillsRoot, SKILL_NAME } from "./skill.js";
import { packageVersion } from "./version.js";

export const USAGE = `usage: sessionist update [--now] [--json]

Bring the running pieces up to the installed version: restart the login
service, which from the npx cache starts the newest published release, and
refresh the /sessionist-connect skill when it changed. Coding-agent sessions
already open keep their reader until they start again.

  --now   restart even while a session is recording; what arrives during the
          restart is lost

A global install (npm i -g sessionist) gets new code from
\`npm i -g sessionist@latest\`; run this afterwards.`;

/** How long to wait for the restarted sink to answer; from the npx cache the first start fetches the package. */
const STARTUP_WAIT_MS = 30_000;

interface Step {
  done: boolean;
  detail: string;
}

async function runningSessions(apiPort: number): Promise<number> {
  try {
    const response = await fetch(`http://127.0.0.1:${String(apiPort)}/api/sessions?status=running&limit=500`, {
      signal: AbortSignal.timeout(1500),
    });
    if (!response.ok) return 0;
    const body = (await response.json()) as { sessions?: unknown[] };
    return Array.isArray(body.sessions) ? body.sessions.length : 0;
  } catch {
    return 0;
  }
}

function refreshSkill(): Step {
  const root = userSkillsRoot();
  if (!existsSync(join(root, SKILL_NAME, "SKILL.md"))) {
    return { done: true, detail: `/${SKILL_NAME} is not installed; nothing to refresh` };
  }
  try {
    const result = installSkill(root);
    return { done: true, detail: result.changed ? `/${SKILL_NAME} refreshed` : `/${SKILL_NAME} unchanged` };
  } catch (err) {
    return { done: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

export async function update(argv: string[], jsonOutput: boolean): Promise<void> {
  const config = loadConfig();
  const version = packageVersion();
  const before = await sinkHealth(config.apiPort);
  const status = serviceStatus();
  const fromNpx = basename(cliInvocation("serve").command) === "npx";

  // Refuse before touching anything: a restart drops whatever arrives while the sink is down.
  if (status.installed && before !== undefined && !argv.includes("--now")) {
    const running = await runningSessions(config.apiPort);
    if (running > 0) {
      const noun = running === 1 ? "session is" : "sessions are";
      const message =
        `${String(running)} ${noun} still recording (a session closes after ${String(config.gapMinutes)} idle ` +
        "minutes); a restart loses what arrives while the sink is down. Wait, or run again with --now.";
      if (jsonOutput) console.log(JSON.stringify({ refused: true, running, message }));
      else console.log(`! ${message}`);
      process.exitCode = 1;
      return;
    }
  }

  const skill = refreshSkill();

  let service: Step;
  let after: SinkHealth | undefined = before;
  if (!status.supported) {
    service = { done: true, detail: `no login service on ${status.platform}; stop the sink and start it again yourself` };
  } else if (!status.installed) {
    service = {
      done: true,
      detail:
        before === undefined
          ? `no login service installed; the next \`sessionist\` you start runs ${version}`
          : `no login service installed; the sink running ${before.version} is yours to stop and start again`,
    };
  } else {
    const result = restartService();
    if (result.ok) {
      after = await waitForSink(config.apiPort, STARTUP_WAIT_MS);
      const was = before?.version ?? "not running";
      service =
        after === undefined
          ? { done: false, detail: `restarted, but the sink has not answered yet; check \`sessionist service status\`` }
          : { done: true, detail: `sink restarted: ${was} → ${after.version}` };
    } else {
      service = { done: false, detail: result.message };
    }
  }

  if (jsonOutput) {
    console.log(
      JSON.stringify({
        version,
        fromNpx,
        sinkBefore: before?.version ?? null,
        sinkAfter: after?.version ?? null,
        skill,
        service,
      }),
    );
    if (!skill.done || !service.done) process.exitCode = 1;
    return;
  }

  console.log(`${service.done ? "✓" : "!"} ${service.detail}`);
  console.log(`${skill.done ? "✓" : "!"} ${skill.detail}`);
  console.log("  coding-agent sessions already open keep their reader until they start again");
  if (!fromNpx) {
    console.log("  not run from the npx cache, so this restarts the code already on disk; a global install");
    console.log("  gets new code with `npm i -g sessionist@latest`, then this again");
  }
  if (!skill.done || !service.done) process.exitCode = 1;
}
