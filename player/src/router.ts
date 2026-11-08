// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// Minimal history-API router: "/" and "/s/:sessionId/e/:seq" (seq optional).

import { useEffect, useState } from "react";
import { embeddedApi, isEmbedded } from "./embedded";

export interface Route {
  sessionId?: string;
  seq?: number;
}

export function parseRoute(pathname: string): Route {
  const match = /^\/s\/([^/]+)(?:\/e\/(\d+))?$/.exec(pathname);
  if (match === null) return {};
  const route: Route = { sessionId: decodeURIComponent(match[1]!) };
  if (match[2] !== undefined) route.seq = Number(match[2]);
  return route;
}

export function routePath(route: Route): string {
  if (route.sessionId === undefined) return "/";
  const base = `/s/${encodeURIComponent(route.sessionId)}`;
  return route.seq === undefined ? base : `${base}/e/${route.seq}`;
}

export function useRoute(): [Route, (route: Route, replace?: boolean) => void] {
  // Embedded (.session.html on file://): the history API is unusable and
  // there is exactly one session — route lives in memory and boots to it.
  const embedded = isEmbedded();
  const [route, setRoute] = useState<Route>(() =>
    embedded ? {} : parseRoute(window.location.pathname),
  );

  useEffect(() => {
    if (embedded) {
      let cancelled = false;
      embeddedApi.initialSessionId().then((sessionId) => {
        if (!cancelled) setRoute((r) => (r.sessionId === undefined ? { sessionId } : r));
      });
      return () => {
        cancelled = true;
      };
    }
    const onPop = (): void => setRoute(parseRoute(window.location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [embedded]);

  const navigate = (next: Route, replace = false): void => {
    if (!embedded) {
      const path = routePath(next);
      if (path !== window.location.pathname) {
        if (replace) window.history.replaceState(null, "", path);
        else window.history.pushState(null, "", path);
      }
    }
    setRoute(next);
  };

  return [route, navigate];
}
