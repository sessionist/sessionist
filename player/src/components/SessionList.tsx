// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

import type { SessionSummary } from "../api";

type Filter = "all" | "running" | "error";

function shortTime(iso: string): string {
  return iso.slice(0, 19).replace("T", " ");
}

export function SessionList({
  sessions,
  selectedId,
  filter,
  onFilter,
  onSelect,
}: {
  sessions: SessionSummary[];
  selectedId?: string | undefined;
  filter: Filter;
  onFilter: (f: Filter) => void;
  onSelect: (id: string) => void;
}) {
  const filtered = sessions.filter((s) => filter === "all" || s.status === filter);
  return (
    <nav className="rail" aria-label="sessions">
      <div className="rail-filters" role="group" aria-label="filter by status">
        {(["all", "running", "error"] as const).map((f) => (
          <button key={f} className={`chip ${filter === f ? "on" : ""}`} onClick={() => onFilter(f)}>
            {f}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <p className="empty">
          No sessions yet. Point an OTel-instrumented agent at{" "}
          <code>http://127.0.0.1:4318</code> and its next run appears here.
        </p>
      ) : (
        filtered.map((s) => (
          <button
            key={s.id}
            className={`session-row ${s.id === selectedId ? "selected" : ""}`}
            onClick={() => onSelect(s.id)}
          >
            <span className="svc">
              <span className={`status-dot status-${s.status}`} aria-label={s.status} />
              {s.service ?? "unknown service"}
            </span>
            <div className="when mono">{shortTime(s.startedAt)}</div>
            <div className="counts mono">
              {s.eventCount} events · {s.status}
            </div>
          </button>
        ))
      )}
    </nav>
  );
}
