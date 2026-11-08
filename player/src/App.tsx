// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

import { useEffect, useMemo, useRef, useState } from "react";
import { listSessions, search, subscribeActivity, type SessionSummary } from "./api";
import { useRoute } from "./router";
import { Mark } from "./components/Mark";
import { Odometer } from "./components/Odometer";
import { SessionList } from "./components/SessionList";
import { SessionView } from "./views/SessionView";

export function App() {
  const [route, navigate] = useRoute();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [filter, setFilter] = useState<"all" | "running" | "error">("all");
  const [query, setQuery] = useState("");
  const [activityTick, setActivityTick] = useState(0);
  const activeSessionRef = useRef<string | undefined>(undefined);
  activeSessionRef.current = route.sessionId;

  const refreshList = useMemo(
    () => (): void => {
      if (query.trim() !== "") {
        search(query)
          .then((r) => setSessions(r.sessions))
          .catch(() => {});
      } else {
        listSessions()
          .then((r) => setSessions(r.sessions))
          .catch(() => {});
      }
    },
    [query],
  );

  useEffect(refreshList, [refreshList]);

  useEffect(() => {
    return subscribeActivity((sessionIds) => {
      refreshList();
      const active = activeSessionRef.current;
      if (active !== undefined && (sessionIds.length === 0 || sessionIds.includes(active))) {
        setActivityTick((t) => t + 1);
      }
    });
  }, [refreshList]);

  const anyLive = sessions.some((s) => s.status === "running");

  return (
    <div className="app">
      <header className="topbar">
        <Mark state={anyLive ? "live" : "static"} size={32} />
        <span className="wordmark">sessionist</span>
        <span className="spacer" />
        <Odometer />
        <input
          className="search"
          type="search"
          placeholder="search payloads…"
          value={query}
          onChange={(ev) => setQuery(ev.target.value)}
          aria-label="search payloads"
        />
      </header>
      <div className="main">
        <SessionList
          sessions={sessions}
          selectedId={route.sessionId}
          filter={filter}
          onFilter={setFilter}
          onSelect={(id) => navigate({ sessionId: id })}
        />
        {route.sessionId !== undefined ? (
          <SessionView
            key={route.sessionId}
            sessionId={route.sessionId}
            seq={route.seq}
            activityTick={activityTick}
            onSelectSeq={(seq) =>
              navigate({ sessionId: route.sessionId as string, seq }, true)
            }
          />
        ) : (
          <main className="session-view">
            <p className="empty">
              Pick a session to play it back. The recording shows every step your agent took —
              exact prompts, tool IO, and errors, as they happened.
            </p>
          </main>
        )}
      </div>
    </div>
  );
}
