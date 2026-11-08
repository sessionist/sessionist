// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The player is a Query API client and nothing more. In dev, /api proxies to
// the running sessionist daemon; in production the daemon serves the built
// assets itself from the same port.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4319",
        changeOrigin: true,
      },
    },
  },
});
