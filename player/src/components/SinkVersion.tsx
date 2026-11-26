// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// The version of the sink serving this page, since the sink is the process that goes stale.

import { useEffect, useState } from "react";
import { getHealth, type SinkHealth } from "../api";
import { isEmbedded } from "../embedded";
import { formatUptime } from "../lib/uptime";

export function SinkVersion() {
  const [health, setHealth] = useState<SinkHealth | null>(null);

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
  return (
    <span className="version mono" title={`sink ${health.version}, up ${formatUptime(health.uptimeMs)}`}>
      v{health.version}
    </span>
  );
}
