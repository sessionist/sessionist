// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface SessionistConfig {
  otlpPort: number; // OTLP receiver (standard OTLP/HTTP port)
  apiPort: number; // Query API (+ player static assets)
  dataDir: string; // sessions.db + blobs/
  gapMinutes: number; // idle gap that closes a session
  // True once the first-run setup prompt has been answered either way.
  setupPrompted: boolean;
}

export const DEFAULTS: Omit<SessionistConfig, "dataDir"> = {
  otlpPort: 4318,
  apiPort: 4319,
  gapMinutes: 10,
  setupPrompted: false,
};

export function defaultDataDir(): string {
  return process.env["SESSIONIST_DATA_DIR"] ?? join(homedir(), ".sessionist");
}

export function loadConfig(): SessionistConfig {
  const dataDir = defaultDataDir();
  const configPath = join(dataDir, "config.json");
  let fileConfig: Partial<SessionistConfig> = {};
  if (existsSync(configPath)) {
    try {
      fileConfig = JSON.parse(readFileSync(configPath, "utf8")) as Partial<SessionistConfig>;
    } catch {
      // Unreadable config falls back to defaults; never crash startup on it.
    }
  }
  const envPort = (name: string): number | undefined => {
    const v = process.env[name];
    if (v === undefined) return undefined;
    const n = Number(v);
    return Number.isInteger(n) && n > 0 ? n : undefined;
  };
  return {
    otlpPort: envPort("SESSIONIST_OTLP_PORT") ?? fileConfig.otlpPort ?? DEFAULTS.otlpPort,
    apiPort: envPort("SESSIONIST_API_PORT") ?? fileConfig.apiPort ?? DEFAULTS.apiPort,
    dataDir,
    gapMinutes: fileConfig.gapMinutes ?? DEFAULTS.gapMinutes,
    setupPrompted: fileConfig.setupPrompted ?? DEFAULTS.setupPrompted,
  };
}

export function saveConfigValue(key: "otlpPort" | "apiPort" | "gapMinutes" | "setupPrompted", value: number | boolean): void {
  const dataDir = defaultDataDir();
  mkdirSync(dataDir, { recursive: true });
  const configPath = join(dataDir, "config.json");
  let current: Record<string, unknown> = {};
  if (existsSync(configPath)) {
    try {
      current = JSON.parse(readFileSync(configPath, "utf8")) as Record<string, unknown>;
    } catch {
      current = {};
    }
  }
  current[key] = value;
  writeFileSync(configPath, JSON.stringify(current, null, 2) + "\n");
}
