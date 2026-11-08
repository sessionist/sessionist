// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

import { defineConfig } from "tsup";

export default defineConfig({
  entry: { cli: "src/cli/index.ts" },
  format: ["esm"],
  platform: "node",
  target: "node20",
  external: ["better-sqlite3"],
  clean: true,
  sourcemap: true,
});
