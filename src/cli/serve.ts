// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

import type { Server } from "node:http";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../config.js";
import { openDb } from "../store/db.js";
import { SessionStore } from "../store/store.js";
import { Assembler } from "../assemble/assembler.js";
import { normalizeLogRecord, normalizeSpan } from "../normalize/index.js";
import { createReceiver } from "../receiver/server.js";
import { createApiServer } from "../api/http.js";
import { storeInfo } from "../api/query.js";
import { scheduleUpdateChecks, selfUpdateAbility, updateBlock, type SelfUpdate } from "../update/check.js";
import { requestRestart } from "../update/restart.js";
import { packageVersion } from "./version.js";
import { maybePromptSetup } from "./setup.js";

/** Whether a restart would bring a newer release depends on the login service; asking the supervisor costs a
 *  spawn, so the answer is kept for a minute. */
function abilityCache(): () => SelfUpdate {
  let known: { value: SelfUpdate; at: number } | undefined;
  return () => {
    if (known === undefined || Date.now() - known.at > 60_000) known = { value: selfUpdateAbility(), at: Date.now() };
    return known.value;
  };
}

const SWEEP_INTERVAL_MS = 30_000;

function listen(server: Server, port: number, label: string): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        reject(new Error(`${label} port ${port} is already in use (is sessionist already running?)`));
      } else {
        reject(err);
      }
    });
    server.listen(port, "127.0.0.1", () => resolve());
  });
}

/** dist/player next to the bundled CLI, or player/dist in a dev checkout; absent means API-only. */
function findPlayerDist(): string | undefined {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const candidate of [join(here, "player"), join(here, "..", "player", "dist")]) {
    if (existsSync(join(candidate, "index.html"))) return candidate;
  }
  return undefined;
}

export async function serve(jsonOutput: boolean, argv: string[] = []): Promise<void> {
  const config = loadConfig();
  const version = packageVersion();
  const db = openDb(config.dataDir);
  const store = new SessionStore(db, config.dataDir);

  const playerDist = findPlayerDist();
  const ability = abilityCache();
  const api = createApiServer({
    db,
    dataDir: config.dataDir,
    version,
    ...(playerDist !== undefined ? { playerDist } : {}),
    otlpPort: config.otlpPort,
    apiPort: config.apiPort,
    // Config is re-read on each call so a `config set updateCheck off` applies without a restart.
    update: () => updateBlock(loadConfig(), version, ability()),
    restart: (now) =>
      requestRestart({
        now,
        running: storeInfo(db, config.dataDir).running,
        gapMinutes: config.gapMinutes,
        ability: ability(),
        version,
      }),
  });

  const assembler = new Assembler(store, {
    gapMs: config.gapMinutes * 60_000,
    onActivity: (sessionIds) => api.broadcastActivity(sessionIds),
  });
  assembler.recover();

  const receiver = createReceiver({
    onSpans: (spans) => assembler.ingest(spans.flatMap((s) => normalizeSpan(s))),
    onLogs: (logs) => assembler.ingest(logs.flatMap((l) => normalizeLogRecord(l))),
    onError: (context, err) => {
      console.error(`[receiver] ${context}: ${err instanceof Error ? err.message : String(err)}`);
    },
  });

  await listen(receiver, config.otlpPort, "OTLP receiver");
  await listen(api.server, config.apiPort, "Query API");
  // After the ports are bound, so a slow registry can never delay capture.
  scheduleUpdateChecks();

  const sweepTimer = setInterval(() => assembler.sweep(), SWEEP_INTERVAL_MS);

  // Registered before the first-run prompt: its Ctrl-C handler re-emits SIGINT on the
  // process, which does nothing unless someone is already listening.
  const shutdown = (): void => {
    clearInterval(sweepTimer);
    receiver.close();
    api.server.close();
    db.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  const otlpUrl = `http://127.0.0.1:${config.otlpPort}`;
  const apiUrl = `http://127.0.0.1:${config.apiPort}`;
  if (jsonOutput) {
    console.log(
      JSON.stringify({ version, otlpUrl, apiUrl, playerUrl: playerDist !== undefined ? apiUrl : null, dataDir: config.dataDir }),
    );
  } else {
    console.log(`sessionist v${version}`);
    if (playerDist !== undefined) {
      console.log(`  player         ${apiUrl}`);
    }
    console.log(`  OTLP receiver  ${otlpUrl}   (set OTEL_EXPORTER_OTLP_ENDPOINT=${otlpUrl})`);
    console.log(`  Query API      ${apiUrl}/api`);
    console.log(`  data           ${config.dataDir}`);
    // The sink is already listening, so a slow or failed registration cannot cost a span.
    await maybePromptSetup({
      skip: argv.includes("--no-setup"),
      yes: argv.includes("--yes") || argv.includes("-y"),
      alreadyPrompted: config.setupPrompted,
    });
    console.log(`\nCapturing. Sessions never leave this machine. Ctrl-C to stop.`);
  }
}
