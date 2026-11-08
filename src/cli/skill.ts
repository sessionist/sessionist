// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// `sessionist skill`: install the shipped coding-agent skill, or print it for an agent that stores skills elsewhere.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const SKILL_NAME = "sessionist-connect";

/** dist/skills next to the bundled CLI, or skills/ at the repo root in a dev checkout. */
export function findSkillFile(name: string = SKILL_NAME): string | undefined {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const base of [join(here, "skills"), join(here, "..", "..", "skills")]) {
    const candidate = join(base, name, "SKILL.md");
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

export function stripFrontmatter(text: string): string {
  if (!text.startsWith("---\n")) return text;
  const close = text.indexOf("\n---\n", 4);
  if (close === -1) return text;
  return text.slice(close + "\n---\n".length).replace(/^\n+/, "");
}

export interface InstallResult {
  name: string;
  path: string;
  changed: boolean;
}

/** Overwrites only this skill's own file; `changed: false` when the bytes already match. */
export function installSkill(skillsRoot: string, name: string = SKILL_NAME): InstallResult {
  const source = findSkillFile(name);
  if (source === undefined) {
    throw new Error(`skill "${name}" is missing from this installation (expected dist/skills/${name}/SKILL.md)`);
  }
  const content = readFileSync(source, "utf8");
  const target = join(skillsRoot, name, "SKILL.md");
  if (existsSync(target) && readFileSync(target, "utf8") === content) {
    return { name, path: target, changed: false };
  }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
  return { name, path: target, changed: true };
}

export function userSkillsRoot(): string {
  return join(homedir(), ".claude", "skills");
}

export function projectSkillsRoot(cwd: string = process.cwd()): string {
  return join(cwd, ".claude", "skills");
}

const USAGE = `usage: sessionist skill <install|print|path> [--project]

  install    write the ${SKILL_NAME} skill into ~/.claude/skills
             (--project writes into ./.claude/skills instead)
  print      print the skill text without frontmatter, to paste into an agent
             that stores skills elsewhere
  path       print where the shipped skill file lives

In Claude Code the installed skill is /${SKILL_NAME}, and it also triggers on
phrases like "connect my agent to sessionist". Reading sessions needs no skill:
the MCP server carries that guidance itself (sessionist mcp).`;

export function skill(subcommand: string | undefined, argv: string[], jsonOutput: boolean): void {
  const project = argv.includes("--project");

  switch (subcommand) {
    case "install": {
      const root = project ? projectSkillsRoot() : userSkillsRoot();
      const result = installSkill(root);
      if (jsonOutput) {
        console.log(JSON.stringify(result));
      } else if (result.changed) {
        console.log(`installed ${result.name} → ${result.path}`);
        console.log(`\nIn Claude Code: /${result.name} (restart or start a new session to pick it up).`);
      } else {
        console.log(`${result.name} is already installed and unchanged → ${result.path}`);
      }
      return;
    }
    case "print": {
      const source = findSkillFile();
      if (source === undefined) {
        throw new Error(`skill "${SKILL_NAME}" is missing from this installation`);
      }
      const body = stripFrontmatter(readFileSync(source, "utf8"));
      if (jsonOutput) console.log(JSON.stringify({ name: SKILL_NAME, body }));
      else process.stdout.write(body);
      return;
    }
    case "path": {
      const source = findSkillFile();
      if (source === undefined) {
        throw new Error(`skill "${SKILL_NAME}" is missing from this installation`);
      }
      if (jsonOutput) console.log(JSON.stringify({ name: SKILL_NAME, path: source }));
      else console.log(source);
      return;
    }
    default:
      console.error(USAGE);
      process.exitCode = 1;
  }
}
