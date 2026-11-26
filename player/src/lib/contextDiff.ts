// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// Context diff between two llm_call inputs; messages match on stringified equality, so an edit shows as removed + added.

export type DiffStatus = "same" | "added" | "removed";

export interface MessageDiffEntry {
  status: DiffStatus;
  message: unknown;
}

/** Pulls the message array out of a payload input: a plain array, or {system_instructions, messages}. */
export function extractMessages(input: unknown): unknown[] | null {
  if (Array.isArray(input)) return input;
  if (typeof input === "object" && input !== null && Array.isArray((input as { messages?: unknown }).messages)) {
    return (input as { messages: unknown[] }).messages;
  }
  return null;
}

/** A string prompt (text completions with the template pre-applied client-side). */
export function extractPromptText(input: unknown): string | null {
  return typeof input === "string" ? input : null;
}

export interface TextDiffBlock {
  status: DiffStatus;
  text: string; // consecutive same-status lines, joined
}

/** Line-based LCS diff for string prompts, merged into same-status blocks. */
export function diffPromptText(prev: string, curr: string): TextDiffBlock[] {
  const entries = diffLines(prev.split("\n"), curr.split("\n"));
  const blocks: TextDiffBlock[] = [];
  for (const entry of entries) {
    const last = blocks[blocks.length - 1];
    if (last !== undefined && last.status === entry.status) {
      last.text += "\n" + entry.line;
    } else {
      blocks.push({ status: entry.status, text: entry.line });
    }
  }
  return blocks;
}

function diffLines(a: string[], b: string[]): { status: DiffStatus; line: string }[] {
  const n = a.length;
  const m = b.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }
  const out: { status: DiffStatus; line: string }[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ status: "same", line: b[j]! });
      i++;
      j++;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      out.push({ status: "removed", line: a[i]! });
      i++;
    } else {
      out.push({ status: "added", line: b[j]! });
      j++;
    }
  }
  while (i < n) out.push({ status: "removed", line: a[i++]! });
  while (j < m) out.push({ status: "added", line: b[j++]! });
  return out;
}

/** LCS-based diff, ordered like the current call's context with removals
 *  interleaved where they used to sit. */
export function diffMessageArrays(prev: unknown[], curr: unknown[]): MessageDiffEntry[] {
  const a = prev.map((m) => JSON.stringify(m));
  const b = curr.map((m) => JSON.stringify(m));
  const n = a.length;
  const m = b.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }
  const out: MessageDiffEntry[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ status: "same", message: curr[j] });
      i++;
      j++;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      out.push({ status: "removed", message: prev[i] });
      i++;
    } else {
      out.push({ status: "added", message: curr[j] });
      j++;
    }
  }
  while (i < n) out.push({ status: "removed", message: prev[i++] });
  while (j < m) out.push({ status: "added", message: curr[j++] });
  return out;
}
