// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// The timeline strip: every event is a tick, height binned by duration; click or drag to scrub.
// The selected tick is the only selection indicator here.

import { useRef } from "react";
import type { TimelineEvent } from "../api";

function heightClass(e: TimelineEvent): number {
  const ms = e.durationMs ?? 0;
  if (ms <= 0) return 12;
  if (ms < 50) return 18;
  if (ms < 1000) return 28;
  return 42;
}

export function Timeline({
  events,
  selectedSeq,
  onSelect,
}: {
  events: TimelineEvent[];
  selectedSeq?: number | undefined;
  onSelect: (seq: number) => void;
}) {
  const stripRef = useRef<HTMLDivElement>(null);
  const selectedIndex = events.findIndex((e) => e.seq === selectedSeq);

  // Ticks are width-capped, so with few events they fill only part of the strip; pick by
  // each tick's real position, nearest wins, rather than by a fraction of the strip width.
  const pick = (clientX: number): void => {
    const strip = stripRef.current;
    if (strip === null || events.length === 0) return;
    let nearest = -1;
    let nearestDistance = Infinity;
    Array.from(strip.children).forEach((child, i) => {
      const r = (child as HTMLElement).getBoundingClientRect();
      const distance = Math.abs(r.left + r.width / 2 - clientX);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = i;
      }
    });
    const event = events[nearest];
    if (event !== undefined) onSelect(event.seq);
  };

  return (
    <div
      className="tape"
      onPointerDown={(ev) => {
        (ev.target as Element).setPointerCapture?.(ev.pointerId);
        pick(ev.clientX);
      }}
      onPointerMove={(ev) => {
        if (ev.buttons === 1) pick(ev.clientX);
      }}
      role="slider"
      aria-label="timeline scrubber"
      aria-valuemin={0}
      aria-valuemax={Math.max(events.length - 1, 0)}
      aria-valuenow={selectedIndex === -1 ? 0 : selectedIndex}
    >
      <div className="tape-ticks" ref={stripRef}>
        {events.map((e) => (
          <div
            key={e.seq}
            className={`tick ${e.status === "error" ? "err" : ""} ${e.seq === selectedSeq ? "sel" : ""}`}
            style={{ height: heightClass(e) }}
            title={`${e.seq} ${e.type} ${e.name}`}
          />
        ))}
      </div>
      <div className="tape-meta mono">
        <span>{events.length > 0 ? events[0]!.ts.slice(11, 23) : ""}</span>
        <span>
          {selectedIndex === -1 ? "—" : `${selectedIndex + 1} of ${events.length}`}
          {"  ·  ← → step · E next error · space play"}
        </span>
        <span>{events.length > 0 ? events[events.length - 1]!.ts.slice(11, 23) : ""}</span>
      </div>
    </div>
  );
}
