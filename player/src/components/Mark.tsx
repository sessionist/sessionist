// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// The brand mark: the letter S on a 7x7 dot grid with a field of smaller dots. Monochrome
// via currentColor, never rotated; live = the field breathes, playing = the ink dots
// light in sequence along the S.

export type MarkState = "static" | "live" | "playing";

const PITCH = 100;
const INK_R = 39;
const FIELD_R = 19.5;

type Cell = [row: number, col: number];

// Ink cells in S-path order, so the playing sequence reads as the letter being drawn.
const INK: Cell[] = [
  [1, 5], [0, 4], [0, 3], [0, 2], [1, 1], [2, 1],
  [3, 2], [3, 3], [3, 4],
  [4, 5], [5, 5], [6, 4], [6, 3], [6, 2], [5, 1],
];
const FIELD: Cell[] = [
  [1, 2], [1, 3], [1, 4],
  [2, 0], [2, 2], [2, 3], [2, 4], [2, 5], [2, 6],
  [3, 0], [3, 1], [3, 5], [3, 6],
  [4, 0], [4, 1], [4, 2], [4, 3], [4, 4], [4, 6],
  [5, 2], [5, 3], [5, 4],
];

const center = (i: number) => PITCH / 2 + i * PITCH;

export function Mark({ state = "static", size = 32 }: { state?: MarkState; size?: number }) {
  const stateClass = state === "live" ? "mark-live" : state === "playing" ? "mark-playing" : "";
  return (
    <svg width={size} height={size} viewBox="0 0 700 700" aria-hidden="true" className={`mark ${stateClass}`.trim()}>
      <g className="mark-field">
        {FIELD.map(([r, c], i) => (
          <circle
            key={`f${r}${c}`}
            cx={center(c)}
            cy={center(r)}
            r={FIELD_R}
            fill="currentColor"
            opacity={0.45}
            style={{ animationDelay: `${(i % 6) * 0.15}s` }}
          />
        ))}
      </g>
      <g className="mark-ink">
        {INK.map(([r, c], i) => (
          <circle
            key={`i${r}${c}`}
            cx={center(c)}
            cy={center(r)}
            r={INK_R}
            fill="currentColor"
            style={{ animationDelay: `${i * 0.12}s` }}
          />
        ))}
      </g>
    </svg>
  );
}
