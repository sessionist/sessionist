// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

import { createRequire } from "node:module";

export function packageVersion(): string {
  const require = createRequire(import.meta.url);
  for (const candidate of ["../package.json", "../../package.json"]) {
    try {
      const pkg = require(candidate) as { name?: string; version?: string };
      if (pkg.name === "sessionist" && typeof pkg.version === "string") return pkg.version;
    } catch {
      // try next
    }
  }
  return "unknown";
}

/** Numeric order of two dotted versions, prerelease tags ignored; anything unparsable counts as 0. */
export function compareVersions(a: string, b: string): number {
  const parts = (v: string): number[] =>
    v
      .replace(/^v/, "")
      .split("-")[0]!
      .split(".")
      .map((p) => Number.parseInt(p, 10) || 0);
  const pa = parts(a);
  const pb = parts(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return Math.sign(d);
  }
  return 0;
}
