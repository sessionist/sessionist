// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// `sessionist setup`: attach a reader (MCP server, skill, login service), plus the first-run prompt `serve` calls.

import { createInterface } from "node:readline";
import { loadConfig, saveConfigValue } from "../config.js";
import { userSkillsRoot } from "./skill.js";
import { describeStart, sinkHealth, START_WAIT_MS, waitForSink, type SinkHealth } from "./service.js";
import { serviceFile } from "../service/install.js";
import { detect, isFullyAttached, type Detection } from "../setup/detect.js";
import {
  applySetup,
  findOccupancy,
  manualSteps,
  mcpJsonBlock,
  skillInstallCommand,
  type ApplyResult,
  type Occupancy,
} from "../setup/apply.js";

function reportApply(result: ApplyResult): void {
  for (const step of [result.mcp, result.skill, result.service]) {
    console.log(`  ${step.done ? "✓" : "!"} ${step.detail}`);
  }
}

/** This process is serving in the foreground, so the service can be registered but not started. */
function selfOccupancy(): Occupancy {
  return { port: loadConfig().apiPort, key: "apiPort", sink: true, self: true };
}

function printManual(detection: Detection, lead: string, withSetupCommand = true): void {
  const steps = manualSteps(detection);
  if (steps.length === 0) return;
  console.log(lead);
  if (withSetupCommand) {
    console.log(`  ${skillInstallCommand()} setup`);
    console.log("\nor by hand:");
  }
  for (const step of steps) console.log(`  ${step}`);
}

/** The config block for agents with no CLI of their own. */
function printForOtherAgents(): void {
  console.log("MCP server, for a coding agent that stores servers in a config file:\n");
  console.log(mcpJsonBlock());
  console.log("\nSkill, for a coding agent that stores skills elsewhere:\n");
  console.log(`  ${skillInstallCommand()} skill print > <that agent's skill location>`);
}

export async function setup(argv: string[], jsonOutput: boolean): Promise<void> {
  const detection = detect();

  if (argv.includes("--print")) {
    if (jsonOutput) {
      console.log(JSON.stringify({ detection, mcpServers: JSON.parse(mcpJsonBlock()) }));
    } else {
      printForOtherAgents();
    }
    return;
  }

  // The sink may be up in another terminal; never start the service while something else holds the ports.
  const config = loadConfig();
  const occupied = findOccupancy(config.otlpPort, config.apiPort, await sinkHealth(config.apiPort));
  const result = applySetup(userSkillsRoot(), detection, occupied);
  // Answered explicitly, so never prompt on a later start.
  saveConfigValue("setupPrompted", true);

  // The service was told to start: check that something answers before calling this done.
  const activated = occupied === false && detection.serviceSupported && result.service.done;
  let started: SinkHealth | undefined;
  if (activated) started = await waitForSink(config.apiPort, START_WAIT_MS);

  if (jsonOutput) {
    console.log(
      JSON.stringify({ detection, result, occupied: occupied === false ? null : occupied, started: started ?? null }),
    );
    return;
  }
  reportApply(result);
  if (activated) console.log(`  ${started !== undefined ? "✓" : "!"} ${describeStart(started, config.apiPort)}`);
  const complete = result.mcp.done && result.skill.done && result.service.done && (!activated || started !== undefined);
  if (!complete) {
    console.log("\nFinish by hand with the command(s) above, then start a new coding-agent session.");
    process.exitCode = 1;
  } else {
    console.log("\nReady. Run /sessionist-connect in your agent's repo to point it here.");
  }
}

/** Ask once, on a TTY, before serving; never throws. `yes` answers for the user, terminal or not. */
export async function maybePromptSetup(opts: { skip: boolean; yes?: boolean; alreadyPrompted: boolean }): Promise<void> {
  if (opts.skip) return;

  // An explicit yes is honoured on every start, so a script can rely on it.
  if (opts.yes === true) {
    const detection = detect();
    saveConfigValue("setupPrompted", true);
    if (isFullyAttached(detection)) return;
    console.log("");
    reportApply(applySetup(userSkillsRoot(), detection, selfOccupancy()));
    return;
  }

  // Already answered: say nothing and probe nothing (under launchd `claude` is not on PATH, so
  // probing would misreport the server as unregistered into the service log at every boot).
  if (opts.alreadyPrompted) return;

  const detection = detect();
  if (isFullyAttached(detection)) return;

  // Not a terminal (a coding agent's shell, CI, a pipe): cannot ask, so say plainly what this
  // process is and is not, then get out of the way.
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.log("\nNo reader is attached, and this sink stops when this process does.");
    console.log("To attach your coding agent and start the sink at login instead, run once:");
    console.log(`  ${skillInstallCommand()} setup`);
    console.log(`(or start with --yes to attach from here)`);
    printManual(detection, "\nBy hand:", false);
    if (!detection.claudeCli && detection.note !== undefined) console.log(`  (${detection.note})`);
    return;
  }

  console.log("\nNo reader is attached yet. Attaching one writes to:");
  if (!detection.mcpRegistered) console.log("  ~/.claude.json          (via the claude CLI, user scope)");
  if (!detection.skillInstalled) console.log(`  ${userSkillsRoot()}`);
  const unit = serviceFile();
  if (detection.serviceSupported && !detection.serviceInstalled && unit !== undefined) {
    console.log(`  ${unit}`);
    console.log("                          (starts the sink at login, so a run with no");
    console.log("                           terminal open is still captured)");
  }
  if (!detection.claudeCli && detection.note !== undefined) console.log(`  note: ${detection.note}`);

  const answer = await ask("\nDo that now? [Y/n] ");
  // Ctrl-C is not an answer: nothing is recorded, and the next start asks again.
  if (answer === INTERRUPTED) return;
  saveConfigValue("setupPrompted", true);

  if (answer === "n" || answer === "no") {
    printManual(detection, "\nSkipped, and I will not ask again. When you want it:");
    return;
  }

  reportApply(applySetup(userSkillsRoot(), detection, selfOccupancy()));
}

/** Ctrl-C result from ask(). Readline in raw mode synthesizes SIGINT and emits `pause` if the instance
 *  has no listener, so ask() handles it and re-emits SIGINT on the process so `serve` shuts down. */
export const INTERRUPTED = "";

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.on("SIGINT", () => {
      rl.close();
      process.stdout.write("\n");
      resolve(INTERRUPTED);
      process.emit("SIGINT");
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}
