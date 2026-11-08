// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// Builds the public tree as a single-commit snapshot of a tagged release and, with
// --push, force-pushes it to the public repository. The source is `git archive`, so
// only tracked files are considered and `.gitattributes` export-ignore decides what is
// left out; a denylist scan then fails the run on any forbidden string.
//
//   node scripts/snapshot.mjs --dry-run [--ref v0.1.0]        build + scan, print the path
//   node scripts/snapshot.mjs --push --ref v0.1.0 [--remote …] [--branch master]
//
// The denylist lives outside the exported tree (see --denylist); this file must not
// contain anything it would need to catch.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] !== undefined && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1]
    : fallback;
}
const has = (name) => process.argv.includes(`--${name}`);

const dryRun = has("dry-run");
const push = has("push");
const ref = arg("ref", "HEAD");
const remote = arg("remote", "git@github.com:sessionist/sessionist.git");
const branch = arg("branch", "master");
const denylistPath = arg("denylist", join(ROOT, "internal", "public-denylist.txt"));
const outDir = arg("out", mkdtempSync(join(tmpdir(), "sessionist-public-")));

if (!dryRun && !push) fail("pass --dry-run or --push");
if (dryRun && push) fail("--dry-run and --push are exclusive");

function git(args, opts = {}) {
  return execFileSync("git", args, { cwd: opts.cwd ?? ROOT, encoding: "utf8", env: { ...process.env, TZ: "UTC", ...opts.env } }).trim();
}
function fail(msg) {
  console.error(`snapshot: ${msg}`);
  process.exit(1);
}

// 1. Source must be clean and, for a push, an exact tag.
if (push) {
  if (git(["status", "--porcelain"]) !== "") fail("working tree is not clean; commit or stash first");
  try {
    git(["describe", "--exact-match", "--tags", ref]);
  } catch {
    fail(`--ref ${ref} is not a tag; publish only from a tag`);
  }
}
const sha = git(["rev-parse", ref]);
const version = JSON.parse(git(["show", `${ref}:package.json`])).version;

// 2. Export only tracked files, minus export-ignore paths.
mkdirSync(outDir, { recursive: true });
const tar = join(outDir, "..", `snapshot-${sha.slice(0, 7)}.tar`);
git(["archive", "--format=tar", "-o", tar, ref]);
execFileSync("tar", ["-xf", tar, "-C", outDir]);

// 3. The public agent entry point imports the shared guide.
if (existsSync(join(outDir, "CLAUDE.md"))) fail("CLAUDE.md was exported; check .gitattributes");
if (existsSync(join(outDir, "internal"))) fail("the private documents directory was exported; check .gitattributes");
writeFileSync(join(outDir, "CLAUDE.md"), "Agent guide for this repository: see AGENTS.md, imported below.\n\n@AGENTS.md\n");

// 4. Scan every exported file against the denylist, case-insensitively.
if (!existsSync(denylistPath)) fail(`denylist not found at ${denylistPath}`);
const patterns = readFileSync(denylistPath, "utf8")
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l !== "" && !l.startsWith("#"))
  .map((l) => l.toLowerCase());

const hits = [];
let files = 0;
for (const file of walk(outDir)) {
  files += 1;
  const buf = readFileSync(file);
  if (buf.includes(0)) continue; // binary
  const text = buf.toString("utf8").toLowerCase();
  for (const p of patterns) {
    if (text.includes(p)) hits.push(`${relative(outDir, file)}: "${p}"`);
  }
}
if (hits.length > 0) {
  console.error(`snapshot: ${hits.length} denylist hit(s):`);
  for (const h of hits) console.error(`  ${h}`);
  process.exit(1);
}

console.log(`snapshot of ${ref} (${sha.slice(0, 7)}), version ${version}: ${files} files, denylist clean`);
console.log(`  tree: ${outDir}`);

if (dryRun) process.exit(0);

// 5. One orphan commit, same identity and SSH binding as the source repo.
const name = git(["config", "user.name"]);
const email = git(["config", "user.email"]);
const sshCommand = git(["config", "--default", "", "core.sshCommand"]);
const message = arg("message", `Sessionist ${version}`);

const g = (args) => git(args, { cwd: outDir });
g(["init", "-q", "-b", branch]);
g(["config", "user.name", name]);
g(["config", "user.email", email]);
if (sshCommand !== "") g(["config", "core.sshCommand", sshCommand]);
g(["add", "-A"]);
g(["commit", "-q", "-m", message]);
g(["tag", `v${version}`]);
g(["remote", "add", "origin", remote]);
g(["push", "--force", "origin", `${branch}:${branch}`]);
g(["push", "--force", "origin", `v${version}`]);
console.log(`pushed ${branch} and v${version} to ${remote} as ${name}`);

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === ".git") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else yield full;
  }
}
