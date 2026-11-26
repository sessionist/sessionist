// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// The version of the sink serving this page, since the sink is the process that goes stale; and, when the
// sink's daily check found a newer release, the one action that gets it there.

import { useEffect, useState } from "react";
import { getHealth, requestUpdate, type SinkHealth } from "../api";
import { isEmbedded } from "../embedded";
import { formatUptime } from "../lib/uptime";

type Phase =
  | { kind: "idle" }
  | { kind: "confirm"; running: number }
  | { kind: "command"; command: string }
  | { kind: "restarting"; to: string };

export function SinkVersion() {
  const [health, setHealth] = useState<SinkHealth | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  useEffect(() => {
    if (isEmbedded()) return;
    let cancelled = false;
    const refresh = (): void => {
      getHealth()
        .then((h) => {
          if (!cancelled) setHealth(h);
        })
        .catch(() => {});
    };
    refresh();
    // A restart changes the answer; the next look at the window is when it matters.
    window.addEventListener("focus", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", refresh);
    };
  }, []);

  if (health === null) return null;
  const update = health.update;
  const newer =
    update !== undefined && update.checksEnabled && update.available === true && update.latest !== undefined
      ? update
      : undefined;

  const act = async (now: boolean): Promise<void> => {
    if (newer === undefined) return;
    if (!newer.canSelfUpdate) {
      setPhase({ kind: "command", command: newer.command });
      return;
    }
    try {
      const outcome = await requestUpdate(now);
      if ("restarting" in outcome) {
        setPhase({ kind: "restarting", to: newer.latest ?? "" });
        await waitForRestart(health.version);
        window.location.reload();
      } else if ("running" in outcome) {
        setPhase({ kind: "confirm", running: outcome.running });
      } else {
        setPhase({ kind: "command", command: outcome.command });
      }
    } catch {
      setPhase({ kind: "idle" });
    }
  };

  return (
    <span className="version mono" title={describe(health)}>
      v{health.version}
      {newer !== undefined && phase.kind === "idle" && (
        <>
          {" · "}
          <button type="button" className="update-action" onClick={() => void act(false)}>
            {newer.latest} available
          </button>
        </>
      )}
      {newer !== undefined && phase.kind === "confirm" && (
        <>
          {` · ${String(phase.running)} ${phase.running === 1 ? "session" : "sessions"} recording · `}
          <button type="button" className="update-action" onClick={() => void act(true)}>
            restart on {newer.latest} anyway
          </button>
        </>
      )}
      {phase.kind === "command" && <>{` · ${phase.command}`}</>}
      {phase.kind === "restarting" && <>{` · restarting on ${phase.to}…`}</>}
    </span>
  );
}

/** The old process answers for a moment, then nothing, then the new one with a small uptime. */
async function waitForRestart(oldVersion: string): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const h = await getHealth();
      if (h !== null && (h.version !== oldVersion || h.uptimeMs < 10_000)) return;
    } catch {
      // the sink is down between the old process and the new
    }
  }
}

/** The tooltip: never "up to date", since a check can be a day old; what was asked and when, or why not. */
function describe(h: SinkHealth): string {
  const parts = [`sink ${h.version}, up ${formatUptime(h.uptimeMs)}`];
  const u = h.update;
  if (u === undefined) return parts[0]!;
  if (!u.checksEnabled) parts.push(u.reason === "offline" ? "update checks off (--offline)" : "update checks off (config)");
  else if (u.checkedAt !== undefined) parts.push(`asked the registry ${formatUptime(Date.now() - Date.parse(u.checkedAt))} ago`);
  else parts.push("the registry has not been asked yet");
  return parts.join(" · ");
}
