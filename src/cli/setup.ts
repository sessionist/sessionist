// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// `sessionist setup`: attach a reader (MCP server, skill, login service), plus the first-run prompt `serve` calls.

import { createInterface } from "node:readline";
import { loadConfig, saveConfigValue } from "../config.js";
import { userSkillsRoot } from "./skill.js";
import { isSinkListening } from "./service.js";
import { serviceFile } from "../service/install.js";
import { detect, isFullyAttached, type Detection } from "../setup/detect.js";
import { applySetup, manualSteps, mcpJsonBlock, skillInstallCommand, type ApplyResult } from "../setup/apply.js";

function reportApply(result: ApplyResult): void {
  for (const step of [result.mcp, result.skill, result.service]) {
    console.log(`  ${step.done ? "✓" : "!"} ${step.detail}`);
  }
}

function printManual(detection: Detection, lead: string): void {
  const steps = manualSteps(detection);
  if (steps.length === 0) return;
  console.log(lead);
  console.log(`  ${skillInstallCommand()} setup`);
  console.log("\nor by hand:");
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
  const result = applySetup(userSkillsRoot(), detection, await isSinkListening(loadConfig().apiPort));
  // Answered explicitly, so never prompt on a later start.
  saveConfigValue("setupPrompted", true);

  if (jsonOutput) {
    console.log(JSON.stringify({ detection, result }));
    return;
  }
  reportApply(result);
  if (!result.mcp.done || !result.skill.done || !result.service.done) {
    console.log("\nFinish by hand with the command(s) above, then start a new coding-agent session.");
  } else {
    console.log("\nReady. Run /sessionist-connect in your agent's repo to point it here.");
  }
}

/** Ask once, on a TTY, before serving; never throws. */
export async function maybePromptSetup(opts: { skip: boolean; alreadyPrompted: boolean }): Promise<void> {
  // Already answered or told not to: say nothing and probe nothing (under launchd `claude` is not on
  // PATH, so probing would misreport the server as unregistered into the service log at every boot).
  if (opts.skip || opts.alreadyPrompted) return;

  const detection = detect();
  if (isFullyAttached(detection)) return;

  // Not a terminal (CI, a pipe): cannot ask, so say how, once, and get out of the way.
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    printManual(detection, "\nNo reader is attached yet. To let your coding agent read these sessions:");
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

  // This process holds the ports, so the service is registered but not started.
  reportApply(applySetup(userSkillsRoot(), detection, true));
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
