// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// What `sessionist update` and POST /api/update share: the refusal while a run is recording, and the restart.

import { restartService } from "../service/install.js";
import type { SelfUpdate } from "./check.js";

/** The same sentence from the CLI and the viewer; `anyway` names how to override where it is being read. */
export function refusalMessage(running: number, gapMinutes: number, anyway = "restart anyway"): string {
  const noun = running === 1 ? "session is" : "sessions are";
  return (
    `${String(running)} ${noun} still recording (a session closes after ${String(gapMinutes)} idle minutes); ` +
    `a restart loses what arrives while the sink is down. Wait, or ${anyway}.`
  );
}

export type RestartOutcome =
  | { refused: true; running: number; message: string }
  | { refused: true; reason: "no-service" | "fixed-path" | "unsupported"; command: string }
  | { restarting: true; from: string };

/** Decides, and when the answer is yes schedules the restart a moment later, so the reply leaves this process
 *  before the supervisor kills it. */
export function requestRestart(opts: {
  now: boolean;
  running: number;
  gapMinutes: number;
  ability: SelfUpdate;
  version: string;
  restart?: () => void;
}): RestartOutcome {
  if (!opts.ability.canSelfUpdate) {
    return { refused: true, reason: opts.ability.reason, command: opts.ability.command };
  }
  if (opts.running > 0 && !opts.now) {
    return { refused: true, running: opts.running, message: refusalMessage(opts.running, opts.gapMinutes) };
  }
  const restart = opts.restart ?? ((): void => void restartService());
  setTimeout(restart, 200);
  return { restarting: true, from: opts.version };
}
