// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts", "src/**/*.test.ts", "player/src/**/*.test.ts"],
    environment: "node",
  },
});
