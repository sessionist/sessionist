// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// One session: timeline scrubber on top, step list + inspector below; keys ← → step, E next error, space play.

import { useCallback, useEffect, useRef, useState } from "react";
import { getSession, getSessionReads, getTimeline, type SessionReads, type SessionSummary, type TimelineEvent } from "../api";
import { formatBytes } from "../components/Odometer";
import { Timeline } from "../components/Timeline";
import { Inspector } from "../components/Inspector";
import { Mark, type MarkState } from "../components/Mark";

// Play advances in recorded time, start to start. A floor keeps bursts of fast steps
// visible; a cap keeps an idle gap from freezing the screen. Both are display pacing
// only; the recorded timestamps and durations are shown unchanged.
const PLAY_MIN_STEP_MS = 80;
const PLAY_MAX_GAP_MS = 4000;

/** Milliseconds for a nanosecond-precision ISO timestamp; Date.parse takes only three
 *  fractional digits, so the rest are dropped. */
function tsMs(ts: string): number {
  const ms = Date.parse(ts.length > 24 ? `${ts.slice(0, 23)}Z` : ts);
  return Number.isFinite(ms) ? ms : NaN;
}

interface SessionBadge {
  text: string;
  warn: boolean;
  tooltip?: string;
}

// Badge text states the limitation; any upgrade nudge lives in the tooltip only.
function sessionBadges(session: SessionSummary, events: TimelineEvent[]): SessionBadge[] {
  const badges: SessionBadge[] = [];
  if (events.some((e) => e.provenance.captureMode === "proxy")) {
    badges.push({
      text: "captured via proxy — tool and agent-structure steps not visible",
      warn: true,
      tooltip: "Proxy capture saw model calls only; this session was recorded by an earlier Sessionist with the pass-through proxy.",
    });
  }
  if (events.some((e) => (e.attrs["otel.dropped_attributes_count"] as number | undefined ?? 0) > 0)) {
    badges.push({ text: "some attributes truncated at source", warn: true });
  }
  const ns = session.meta["sessionist"] as Record<string, unknown> | undefined;
  if (typeof ns?.["grouping_rule"] === "string" && ns["grouping_rule"] === "time_window") {
    badges.push({ text: "grouped by time window (no conversation id)", warn: false });
  }
  return badges;
}

export function SessionView({
  sessionId,
  seq,
  activityTick,
  onSelectSeq,
}: {
  sessionId: string;
  seq?: number | undefined;
  activityTick: number;
  onSelectSeq: (seq: number) => void;
}) {
  const [session, setSession] = useState<SessionSummary | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reads, setReads] = useState<SessionReads | null>(null);
  const [playing, setPlaying] = useState(false);
  const playTimer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getSession(sessionId), getTimeline(sessionId)])
      .then(([s, evs]) => {
        if (cancelled) return;
        setSession(s);
        setEvents(evs);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "failed to load session");
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, activityTick]);

  useEffect(() => {
    let cancelled = false;
    getSessionReads(sessionId)
      .then((r) => {
        if (!cancelled) setReads(r);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [sessionId, activityTick]);

  const selected = events.find((e) => e.seq === seq);
  const selectedIndex = events.findIndex((e) => e.seq === seq);
  // Context-diff baseline: the previous llm_call (ts order) that captured a payload — double
  // instrumentation can interleave content-less duplicates, which cannot be diffed.
  const prevLlmCall =
    selected?.type === "llm_call" && selectedIndex > 0
      ? [...events.slice(0, selectedIndex)]
          .reverse()
          .find((e) => e.type === "llm_call" && e.hasPayload)
      : undefined;

  const step = useCallback(
    (delta: number): void => {
      if (events.length === 0) return;
      const index = selectedIndex === -1 ? (delta > 0 ? 0 : events.length - 1) : selectedIndex + delta;
      const event = events[Math.min(Math.max(index, 0), events.length - 1)];
      if (event !== undefined) onSelectSeq(event.seq);
    },
    [events, selectedIndex, onSelectSeq],
  );

  const nextError = useCallback((): void => {
    if (events.length === 0) return;
    const from = selectedIndex === -1 ? 0 : selectedIndex + 1;
    const hit =
      events.slice(from).find((e) => e.status === "error") ??
      events.find((e) => e.status === "error");
    if (hit !== undefined) onSelectSeq(hit.seq);
  }, [events, selectedIndex, onSelectSeq]);

  useEffect(() => {
    if (!playing) return;
    if (selectedIndex === -1) {
      step(1); // nothing selected yet: start from the first step
      return;
    }
    const current = events[selectedIndex];
    const next = events[selectedIndex + 1];
    if (current === undefined || next === undefined) return;
    const recorded = tsMs(next.ts) - tsMs(current.ts);
    const delay = Number.isFinite(recorded)
      ? Math.min(Math.max(recorded, PLAY_MIN_STEP_MS), PLAY_MAX_GAP_MS)
      : PLAY_MIN_STEP_MS;
    playTimer.current = window.setTimeout(() => step(1), delay);
    return () => {
      if (playTimer.current !== null) clearTimeout(playTimer.current);
    };
  }, [playing, selectedIndex, events, step]);

  useEffect(() => {
    if (playing && selectedIndex === events.length - 1) setPlaying(false);
  }, [playing, selectedIndex, events.length]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent): void => {
      if (ev.target instanceof HTMLInputElement) return;
      if (ev.key === "ArrowLeft") {
        step(-1);
        ev.preventDefault();
      } else if (ev.key === "ArrowRight") {
        step(1);
        ev.preventDefault();
      } else if (ev.key === "e" || ev.key === "E") {
        nextError();
      } else if (ev.key === " ") {
        setPlaying((r) => !r);
        ev.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, nextError]);

  if (error !== null) {
    return (
      <main className="session-view">
        <p className="empty">Session failed to load: {error}</p>
      </main>
    );
  }
  if (session === null) {
    return (
      <main className="session-view">
        <p className="empty loading">loading…</p>
      </main>
    );
  }

  const markState: MarkState =
    playing ? "playing" : session.status === "running" ? "live" : "static";
  const badges = sessionBadges(session, events);

  return (
    <main className="session-view">
      <div className="session-head">
        <Mark state={markState} size={32} />
        <strong>{session.service ?? "unknown service"}</strong>
        <span className="id mono">{session.id}</span>
        <span className="mono" style={{ color: "var(--muted)" }}>
          {session.status}
          {session.status === "running" ? " · live" : ""}
        </span>
        {reads !== null && reads.calls > 0 && (
          <span className="mono" style={{ color: "var(--muted)" }}>
            · read {reads.calls}× · {formatBytes(reads.bytes)}
          </span>
        )}
      </div>
      {badges.length > 0 && (
        <div className="session-head">
          {badges.map((b, i) => (
            <span key={i} className={`badge ${b.warn ? "warn" : ""}`} title={b.tooltip}>
              {b.text}
            </span>
          ))}
        </div>
      )}
      <Timeline events={events} selectedSeq={seq} onSelect={onSelectSeq} />
      <div className="split">
        <div className="steps" role="list">
          {events.map((e) => (
            <button
              key={e.seq}
              className={`step-row mono ${e.status === "error" ? "err" : ""} ${e.seq === seq ? "selected" : ""}`}
              onClick={() => onSelectSeq(e.seq)}
            >
              <span className="seq">#{e.seq}</span>
              <span className="etype">{e.type}</span>
              <span className="ename">{e.name}</span>
            </button>
          ))}
        </div>
        <Inspector event={selected} prevLlmCall={prevLlmCall} />
      </div>
    </main>
  );
}
