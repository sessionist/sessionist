// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// The odometer: how much coding agents have read from this store, at a glance.

import { useEffect, useState } from "react";
import { getReadsSummary, type ReadsSummary } from "../api";
import { isEmbedded } from "../embedded";

const REFRESH_MS = 20_000;

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function ago(iso: string, now: number = Date.now()): string {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function Odometer() {
  const [summary, setSummary] = useState<ReadsSummary | null>(null);

  useEffect(() => {
    if (isEmbedded()) return;
    let cancelled = false;
    const refresh = (): void => {
      getReadsSummary()
        .then((s) => {
          if (!cancelled) setSummary(s);
        })
        .catch(() => {});
    };
    refresh();
    const timer = window.setInterval(refresh, REFRESH_MS);
    window.addEventListener("focus", refresh);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  if (summary === null || isEmbedded()) return null;
  if (summary.calls === 0) {
    return (
      <span className="odometer mono" title="No coding agent has read from this store yet.">
        agent reads · none yet
      </span>
    );
  }
  const byClient = summary.byClient
    .map((c) => `${c.client}: ${c.calls} calls, ${formatBytes(c.bytes)}, last ${ago(c.lastTs)}`)
    .join("\n");
  const sessions = `${summary.sessions} session${summary.sessions === 1 ? "" : "s"}`;
  return (
    <span className="odometer mono" title={byClient}>
      agent reads · {summary.calls} calls · {formatBytes(summary.bytes)} · {sessions}
      {summary.lastTs !== undefined ? ` · last ${ago(summary.lastTs)}` : ""}
    </span>
  );
}
