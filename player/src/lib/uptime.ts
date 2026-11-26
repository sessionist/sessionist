// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

/** A duration since the sink started, at the coarseness a tooltip wants. */
export function formatUptime(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "under a minute";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h`;
  return `${Math.floor(hours / 24)} d`;
}
