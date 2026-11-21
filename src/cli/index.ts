#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

import { loadConfig, saveConfigValue } from "../config.js";
import { packageVersion } from "./version.js";
import { serve } from "./serve.js";
import { list } from "./list.js";
import { open } from "./open.js";
import { exportSession, type ExportArgs } from "./export.js";
import { importSession } from "./import.js";
import { mcp } from "./mcp.js";
import { skill, USAGE as SKILL_USAGE } from "./skill.js";
import { setup } from "./setup.js";
import { service, USAGE as SERVICE_USAGE } from "./service.js";
import { update, USAGE as UPDATE_USAGE } from "./update.js";

const HELP = `sessionist — the local OpenTelemetry sink your coding agent can read

Usage:
  sessionist                start the receiver + viewer in this terminal; on first
                            run, offers to attach your coding agent (--yes answers
                            without asking, --no-setup skips the offer)
  sessionist setup          attach your coding agent and exit: register the MCP
                            server, install the /sessionist-connect skill, start
                            the sink at login. The one command for a coding agent
                            to run. (--print for agents with no CLI of their own)
  sessionist list           recent sessions
  sessionist open [id]      open the player (at a session, if given)
  sessionist export <id> [--out file] [--steps a..b] [--eval] [--html]
                            write a portable .session.jsonl artifact, an eval
                            case, or a self-contained .session.html replay
  sessionist import <file>  import a .session.jsonl or .session.html artifact
  sessionist mcp            MCP server (stdio) so coding agents can read sessions
  sessionist skill install [--project]
                            install the sessionist-connect skill into a coding
                            agent (~/.claude/skills, or ./.claude/skills)
  sessionist skill print    the skill text, to paste into any other agent
  sessionist skill path     where the shipped skill file lives
  sessionist service install | uninstall | status
                            start the sink at login, so a run with no terminal
                            open is still captured (macOS and Linux)
  sessionist update         restart the sink on the newest version and refresh
                            the skill (--now: even while a run is recording)
  sessionist config        show config (ports, data dir, gap window)
  sessionist config set <otlpPort|apiPort|gapMinutes> <value>
  sessionist help           this text (also --help, -h; <command> --help for one command)
  sessionist version        the version (also --version, -v)

Options:
  --json                    machine-readable output (available on every command)
  --offline                 hard-disable all network egress

Sessionist never phones home: no telemetry, no accounts, no update pings.
Zero egress is the default; --offline makes it a hard guarantee you can
verify yourself (docs/verify-offline.md). Your sessions never leave your
machine.`;

const COMMANDS = ["serve", "setup", "service", "update", "list", "open", "export", "import", "mcp", "skill", "config", "version", "help"];

/** What `sessionist <command> --help` prints; commands absent here get the full text. */
const COMMAND_HELP: Record<string, string> = {
  serve: `usage: sessionist [serve] [--yes | --no-setup] [--json] [--offline]

Start the OTLP receiver and the viewer in this terminal, and stop when it does.
On the first run, with a terminal attached, offers once to attach your coding
agent (register the MCP server, install the skill, start the sink at login).

  --yes       attach without asking; for scripts and coding agents
  --no-setup  never offer

Without a terminal and without --yes nothing is attached: run \`sessionist setup\`
instead, which attaches everything, starts the sink at login, and exits.`,
  setup: `usage: sessionist setup [--print] [--json]

Attach your coding agent and exit: register the MCP server with Claude Code at
user scope, install the /sessionist-connect skill, and start the sink at login
(launchd on macOS, systemd --user on Linux). Non-interactive and safe to re-run;
each step that is already done is left alone. The one command for a coding
agent to run.

  --print     print the MCP config block and skill command for an agent with no
              CLI of its own, and change nothing`,
  list: `usage: sessionist list [--json]

The most recent sessions: id, status, started, step count.`,
  open: `usage: sessionist open [id] [--json]

Open the player in your browser, at a session when an id is given.`,
  export: `usage: sessionist export <id> [--out file] [--steps a..b] [--eval | --html] [--json]

Write one session as a portable file. By default a .session.jsonl artifact any
agent can read with no server running.

  --out file  where to write (default: next to the current directory)
  --steps a..b  only this range of steps
  --eval      a generic eval case with the expected output left null
  --html      a self-contained .session.html replay that loads nothing from anywhere`,
  import: `usage: sessionist import <file.session.jsonl | file.session.html> [--json]

Import a session artifact into this machine's store.`,
  mcp: `usage: sessionist mcp

The read-only MCP server over stdio. Coding agents start this themselves once it
is registered; \`sessionist setup\` registers it with Claude Code.`,
  config: `usage: sessionist config [set <otlpPort|apiPort|gapMinutes> <value>] [--json]

Show the config (ports, data dir, gap window), or set one value.`,
};

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const jsonOutput = argv.includes("--json");
  const positional = argv.filter((a) => !a.startsWith("-"));
  const command = positional[0] ?? "serve";

  // Flags first: a coding agent probing `--help` must never find itself holding the ports.
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp(positional[0], jsonOutput);
    return;
  }
  if (argv.includes("--version") || argv.includes("-v")) {
    console.log(jsonOutput ? JSON.stringify({ version: packageVersion() }) : packageVersion());
    return;
  }

  switch (command) {
    case "serve":
      await serve(jsonOutput, argv);
      return;
    case "setup":
      await setup(argv, jsonOutput);
      return;
    case "service":
      await service(positional[1], argv, jsonOutput);
      return;
    case "update":
      await update(argv, jsonOutput);
      return;
    case "list":
      await list(jsonOutput);
      return;
    case "open":
      await open(positional[1], jsonOutput);
      return;
    case "export": {
      const sessionId = positional[1];
      if (sessionId === undefined) {
        console.error("usage: sessionist export <id> [--out file] [--steps a..b]");
        process.exitCode = 1;
        return;
      }
      const flag = (name: string): string | undefined => {
        const eq = argv.find((a) => a.startsWith(`--${name}=`));
        if (eq !== undefined) return eq.slice(name.length + 3);
        const i = argv.indexOf(`--${name}`);
        return i !== -1 ? argv[i + 1] : undefined;
      };
      const args: ExportArgs = { sessionId };
      const out = flag("out");
      if (out !== undefined) args.out = out;
      const steps = flag("steps");
      if (steps !== undefined) args.steps = steps;
      if (argv.includes("--eval") && argv.includes("--html")) {
        console.error("--eval and --html are different artifacts; pick one per export");
        process.exitCode = 1;
        return;
      }
      if (argv.includes("--eval")) args.exporterName = "eval-generic";
      if (argv.includes("--html")) args.exporterName = "session-html";
      await exportSession(args, jsonOutput);
      return;
    }
    case "import":
      await importSession(positional[1], jsonOutput);
      return;
    case "mcp":
      await mcp();
      return;
    case "skill":
      skill(positional[1], argv, jsonOutput);
      return;
    case "config": {
      if (positional[1] === "set") {
        const key = positional[2];
        const value = Number(positional[3]);
        if (
          (key !== "otlpPort" && key !== "apiPort" && key !== "gapMinutes") ||
          !Number.isInteger(value) ||
          value <= 0
        ) {
          console.error("usage: sessionist config set <otlpPort|apiPort|gapMinutes> <positive integer>");
          process.exitCode = 1;
          return;
        }
        saveConfigValue(key, value);
      }
      const config = loadConfig();
      if (jsonOutput) console.log(JSON.stringify(config, null, 2));
      else {
        console.log(`otlpPort    ${config.otlpPort}`);
        console.log(`apiPort     ${config.apiPort}`);
        console.log(`gapMinutes  ${config.gapMinutes}`);
        console.log(`setupPrompted ${String(config.setupPrompted)}  (the first-run reader prompt has been answered)`);
        console.log(`dataDir     ${config.dataDir}  (override with SESSIONIST_DATA_DIR)`);
      }
      return;
    }
    case "version":
      console.log(jsonOutput ? JSON.stringify({ version: packageVersion() }) : packageVersion());
      return;
    case "help":
      printHelp(positional[1], jsonOutput);
      return;
    default:
      console.error(`unknown command: ${command}\n`);
      console.log(HELP);
      process.exitCode = 1;
  }
}

/** The full text, or one command's own usage when it has one. */
function printHelp(command: string | undefined, jsonOutput: boolean): void {
  const specific =
    command === "service"
      ? SERVICE_USAGE
      : command === "skill"
        ? SKILL_USAGE
        : command === "update"
          ? UPDATE_USAGE
          : command !== undefined
            ? COMMAND_HELP[command]
            : undefined;
  const text = specific ?? HELP;
  if (jsonOutput) {
    console.log(JSON.stringify(specific !== undefined ? { command, help: text } : { commands: COMMANDS, help: text }));
  } else {
    console.log(text);
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
