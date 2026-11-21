// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// Enforces the MIT SPDX header on all source files (--fix inserts missing ones);
// skills/**/SKILL.md carries it in an HTML comment directly below the YAML frontmatter.

import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, extname, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SCAN_DIRS = ["src", "scripts", "tests", "tools", "player/src", "skills"];
const EXTS = new Set([".ts", ".tsx", ".js", ".mjs", ".md"]);
// Markdown carries a header only under skills/, where the file is shipped product text;
// provenance and note files elsewhere stay exempt.
const EXEMPT = [
  /src\/receiver\/otlp\/gen\//,
  /node_modules/,
  /\.d\.ts$/,
  /^(?!skills[/\\]).*\.md$/,
];
const MARKER = "SPDX-License-Identifier: MIT";
const HEAD_LINES = 5;
// A skill file's frontmatter comes first, so its header starts below it.
const SKILL_HEAD_LINES = 12;

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) yield* walk(full);
    else if (EXTS.has(extname(full))) yield full;
  }
}

function headerFor(rel) {
  if (rel.endsWith(".md")) {
    return "<!-- SPDX-License-Identifier: MIT\n     Copyright (c) 2026 Sessionist -->\n\n";
  }
  return "// SPDX-License-Identifier: MIT\n// Copyright (c) 2026 Sessionist\n\n";
}

/** Insert the header after a shebang, or after a markdown file's frontmatter block. */
function insertHeader(content, header) {
  if (content.startsWith("#!")) {
    const nl = content.indexOf("\n") + 1;
    return content.slice(0, nl) + header + content.slice(nl);
  }
  if (content.startsWith("---\n")) {
    const close = content.indexOf("\n---\n", 4);
    if (close !== -1) {
      const after = close + "\n---\n".length;
      return content.slice(0, after) + "\n" + header + content.slice(after).replace(/^\n+/, "");
    }
  }
  return header + content;
}

const fix = process.argv.includes("--fix");
const missing = [];

for (const dir of SCAN_DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    const rel = relative(ROOT, file);
    if (EXEMPT.some((re) => re.test(rel))) continue;
    const content = readFileSync(file, "utf8");
    const depth = rel.endsWith(".md") ? SKILL_HEAD_LINES : HEAD_LINES;
    const head = content.split("\n").slice(0, depth).join("\n");
    if (!head.includes(MARKER)) {
      if (fix) {
        writeFileSync(file, insertHeader(content, headerFor(rel)));
        console.log(`fixed: ${rel}`);
      } else {
        missing.push(rel);
      }
    }
  }
}

if (missing.length > 0) {
  console.error(`Missing license header (${missing.length}):`);
  for (const f of missing) console.error(`  ${f}`);
  console.error("Run: node scripts/check-headers.mjs --fix");
  process.exit(1);
}
console.log("license headers OK");
