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
