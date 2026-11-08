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
import { skill } from "./skill.js";
import { setup } from "./setup.js";
import { service } from "./service.js";

const HELP = `sessionist — the local OpenTelemetry sink your coding agent can read

Usage:
  sessionist                start the receiver + viewer; on first run, offers to
                            attach your coding agent (--no-setup to skip)
  sessionist setup          attach your coding agent now: register the MCP server,
                            install the /sessionist-connect skill, start at login
                            (--print for agents with no CLI of their own)
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
  sessionist config         show config (ports, data dir, gap window)
  sessionist config set <otlpPort|apiPort|gapMinutes> <value>
  sessionist help
  sessionist version

Options:
  --json                    machine-readable output (available on every command)
  --offline                 hard-disable all network egress

Sessionist never phones home: no telemetry, no accounts, no update pings.
Zero egress is the default; --offline makes it a hard guarantee you can
verify yourself (docs/verify-offline.md). Your sessions never leave your
machine.`;

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const jsonOutput = argv.includes("--json");
  const positional = argv.filter((a) => !a.startsWith("--"));
  const command = positional[0] ?? "serve";

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
      if (jsonOutput) {
        console.log(
          JSON.stringify({
            commands: ["serve", "setup", "service", "list", "open", "export", "import", "mcp", "skill", "config", "version", "help"],
            help: HELP,
          }),
        );
      } else {
        console.log(HELP);
      }
      return;
    default:
      console.error(`unknown command: ${command}\n`);
      console.log(HELP);
      process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
