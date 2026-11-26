// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// Cuts a release in one command: dates the changelog section, bumps the version, commits and tags,
// pushes the private remote, publishes the public snapshot, creates the GitHub release from the
// changelog, and publishes to npm, stopping once for the npm one-time code.
//
//   node scripts/release.mjs 0.1.3             the whole cut
//   node scripts/release.mjs 0.1.3 --dry-run   the checks, the build and the tests, then the plan; writes nothing
//
// Every step before the first write must pass, so a cut never stops half done for a reason it
// could have seen at the start. After the private push, a failure prints what remains, by hand.

import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const PUBLIC_REPO = "sessionist/sessionist";
const PUBLIC_BRANCH = "main";
const PRIVATE_BRANCH = "master";

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const version = argv.find((a) => !a.startsWith("--"));

function fail(msg) {
  console.error(`release: ${msg}`);
  process.exit(1);
}

/** Runs quietly and returns stdout; throws on a non-zero exit. */
function out(cmd, args, opts = {}) {
  return execFileSync(cmd, args, {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, TZ: "UTC", ...opts.env },
    stdio: ["ignore", "pipe", opts.quiet ? "ignore" : "inherit"],
  }).trim();
}

/** Runs with the terminal attached, so prompts (the npm one-time code) and progress show. */
function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, TZ: "UTC", ...opts.env },
  });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) throw new Error(`${cmd} ${args.join(" ")} exited ${String(result.status)}`);
}

function exitStatus(cmd, args) {
  const result = spawnSync(cmd, args, { cwd: ROOT, stdio: "ignore" });
  return result.error !== undefined ? null : result.status;
}

function step(title) {
  console.log(`\n== ${title}`);
}

// 1. The version, and the state the tree must be in.
if (version === undefined) fail("usage: node scripts/release.mjs <version> [--dry-run]");
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/.test(version)) fail(`"${version}" is not a version like 0.1.3`);
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const current = pkg.version;
const numeric = (v) => v.split("-")[0].split(".").map(Number);
const [a, b] = [numeric(version), numeric(current)];
const newer = a[0] !== b[0] ? a[0] > b[0] : a[1] !== b[1] ? a[1] > b[1] : a[2] > b[2];
if (!newer) fail(`${version} is not newer than the current ${current}`);
const tag = `v${version}`;

step(`release ${current} → ${version}${dryRun ? " (dry run)" : ""}`);
const branch = out("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
if (branch !== PRIVATE_BRANCH) fail(`on branch ${branch}; releases are cut from ${PRIVATE_BRANCH}`);
if (out("git", ["status", "--porcelain"]) !== "") fail("working tree is not clean; commit or stash first");
if (exitStatus("git", ["rev-parse", "-q", "--verify", `refs/tags/${tag}`]) === 0) fail(`tag ${tag} already exists`);
if (out("git", ["ls-remote", "--tags", "origin", `refs/tags/${tag}`]) !== "") fail(`tag ${tag} already exists on origin`);
console.log(`branch ${branch}, clean, ${tag} unused`);

// 2. The changelog must have something to release under this version.
const changelogPath = join(ROOT, "CHANGELOG.md");
const changelog = readFileSync(changelogPath, "utf8");
const unreleased = /^## Unreleased[ \t]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(changelog);
if (unreleased === null) fail("CHANGELOG.md has no '## Unreleased' section");
const notes = unreleased[1].trim();
if (notes === "") fail("CHANGELOG.md's Unreleased section is empty; nothing to release");
if (new RegExp(`^## ${version.replace(/\./g, "\\.")}( |$)`, "m").test(changelog)) fail(`CHANGELOG.md already has a ${version} entry`);
if (!/\*\*Contracts:\*\*/.test(notes)) fail("the Unreleased section has no Contracts line; add one before cutting");
console.log(`changelog: ${String(notes.split("\n").length)} lines under Unreleased, Contracts line present`);

// 3. The accounts the later steps need, checked before anything is written.
const ghOk = exitStatus("gh", ["auth", "status"]) === 0;
const npmOk = exitStatus("npm", ["whoami"]) === 0;
if (!ghOk) (dryRun ? console.warn : fail)("gh is not logged in (gh auth login); the GitHub release step needs it");
if (!npmOk) (dryRun ? console.warn : fail)("npm is not logged in (npm login); the publish step needs it");
if (ghOk && npmOk) console.log("gh and npm are logged in");

// 4. Build, typecheck, tests, and the public-tree scan, all on the tree as it is.
step("build");
run("npm", ["run", "build"]);
step("typecheck");
run("npm", ["run", "typecheck"]);
step("tests");
run("npm", ["test"]);
step("public tree scan (denylist)");
run("node", [join(ROOT, "scripts", "snapshot.mjs"), "--dry-run"]);

const today = new Date().toISOString().slice(0, 10);
const heading = `## ${version} — ${today}`;
const notesFile = join(mkdtempSync(join(tmpdir(), "sessionist-release-")), `release-notes-${version}.md`);
writeFileSync(notesFile, `${notes}\n`);

if (dryRun) {
  step("plan (nothing written)");
  console.log(`  CHANGELOG.md: move Unreleased under "${heading}"`);
  console.log(`  npm version ${version} --no-git-tag-version`);
  console.log(`  git commit -m "Sessionist ${version}" (body: the changelog section); git tag -a ${tag}`);
  console.log(`  git push origin ${PRIVATE_BRANCH} ${tag}`);
  console.log(`  node scripts/snapshot.mjs --push --ref ${tag} --branch ${PUBLIC_BRANCH}`);
  console.log(`  gh release create ${tag} --repo ${PUBLIC_REPO} --title "Sessionist ${version}" --notes-file ${notesFile}`);
  console.log(`  npm publish  (asks for the one-time code)`);
  console.log(`\nrelease notes as they would be published: ${notesFile}`);
  process.exit(0);
}

// 5. The writes, in the order that leaves the least to redo if one fails.
const remaining = [
  `node scripts/snapshot.mjs --push --ref ${tag} --branch ${PUBLIC_BRANCH}`,
  `gh release create ${tag} --repo ${PUBLIC_REPO} --title "Sessionist ${version}" --notes-file ${notesFile}`,
  "npm publish",
];
function finished(command) {
  const at = remaining.indexOf(command);
  if (at !== -1) remaining.splice(at, 1);
}

step("changelog, version, commit, tag");
writeFileSync(changelogPath, changelog.replace(/^## Unreleased[ \t]*\n/m, `## Unreleased\n\n${heading}\n`));
run("npm", ["version", version, "--no-git-tag-version"]);
run("git", ["add", "CHANGELOG.md", "package.json", "package-lock.json"]);
run("git", ["commit", "-q", "-m", `Sessionist ${version}`, "-m", notes]);
run("git", ["tag", "-a", tag, "-m", `Sessionist ${version}`]);
console.log(`committed ${out("git", ["rev-parse", "--short", "HEAD"])}, tagged ${tag}`);

step("push the private remote");
run("git", ["push", "origin", PRIVATE_BRANCH]);
run("git", ["push", "origin", tag]);

try {
  step("public snapshot");
  run("node", [join(ROOT, "scripts", "snapshot.mjs"), "--push", "--ref", tag, "--branch", PUBLIC_BRANCH]);
  finished(remaining[0]);

  step("GitHub release");
  run("gh", ["release", "create", tag, "--repo", PUBLIC_REPO, "--title", `Sessionist ${version}`, "--notes-file", notesFile]);
  finished(remaining[0]);

  step("npm publish");
  run("npm", ["publish"]);
  finished(remaining[0]);
} catch (err) {
  console.error(`\nrelease: ${err instanceof Error ? err.message : String(err)}`);
  console.error(`\n${tag} is committed and pushed privately. Still to do, in this order:`);
  for (const command of remaining) console.error(`  ${command}`);
  process.exit(1);
}

step("verify");
let published = "";
for (let attempt = 0; attempt < 10 && published !== version; attempt++) {
  try {
    published = out("npm", ["view", `${pkg.name}@${version}`, "version"], { quiet: true });
  } catch {
    // the registry can lag the publish by a few seconds
  }
  if (published !== version) spawnSync("sleep", ["3"]);
}
if (published !== version) fail(`published, but the registry does not show ${version} yet; check: npm view ${pkg.name} version`);
console.log(`npm: ${pkg.name}@${published}`);
console.log(`GitHub: https://github.com/${PUBLIC_REPO}/releases/tag/${tag}`);
console.log(`\nSessionist ${version} is out.`);
