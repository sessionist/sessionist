// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

import { describe, expect, it } from "vitest";
import { diffMessageArrays, diffPromptText, extractMessages, extractPromptText } from "./contextDiff";

const u = (content: string) => ({ role: "user", content });
const s = (content: string) => ({ role: "system", content });
const a = (content: string) => ({ role: "assistant", content });

describe("extractMessages", () => {
  it("accepts a plain array", () => {
    expect(extractMessages([u("hi")])).toEqual([u("hi")]);
  });
  it("accepts the system_instructions wrapper", () => {
    expect(extractMessages({ system_instructions: "x", messages: [u("hi")] })).toEqual([u("hi")]);
  });
  it("returns null for non-message payloads", () => {
    expect(extractMessages("a completion string")).toBeNull();
    expect(extractMessages(undefined)).toBeNull();
  });
});

describe("diffMessageArrays", () => {
  it("marks appended turns as added", () => {
    const prev = [s("sys"), u("q1")];
    const curr = [s("sys"), u("q1"), a("r1"), u("q2")];
    expect(diffMessageArrays(prev, curr)).toEqual([
      { status: "same", message: s("sys") },
      { status: "same", message: u("q1") },
      { status: "added", message: a("r1") },
      { status: "added", message: u("q2") },
    ]);
  });

  it("marks truncated history as removed, in place", () => {
    const prev = [s("sys"), u("old-1"), a("old-r"), u("q2")];
    const curr = [s("sys"), u("q2"), a("r2"), u("q3")];
    const diff = diffMessageArrays(prev, curr);
    expect(diff).toEqual([
      { status: "same", message: s("sys") },
      { status: "removed", message: u("old-1") },
      { status: "removed", message: a("old-r") },
      { status: "same", message: u("q2") },
      { status: "added", message: a("r2") },
      { status: "added", message: u("q3") },
    ]);
  });

  it("shows an edited message as removed + added — different bytes reached the model", () => {
    const prev = [s("You are terse.")];
    const curr = [s("You are verbose.")];
    expect(diffMessageArrays(prev, curr)).toEqual([
      { status: "removed", message: s("You are terse.") },
      { status: "added", message: s("You are verbose.") },
    ]);
  });

  it("handles empty sides", () => {
    expect(diffMessageArrays([], [u("hi")])).toEqual([{ status: "added", message: u("hi") }]);
    expect(diffMessageArrays([u("hi")], [])).toEqual([{ status: "removed", message: u("hi") }]);
  });
});

describe("extractPromptText", () => {
  it("accepts a raw prompt string and rejects structured payloads", () => {
    expect(extractPromptText("### Instruction:\nhi")).toBe("### Instruction:\nhi");
    expect(extractPromptText([u("hi")])).toBeNull();
    expect(extractPromptText({ messages: [] })).toBeNull();
  });
});

describe("diffPromptText (string prompts)", () => {
  const head = "You are a narrator.\nStyle: terse.";
  const turn1 = "User: hello\nBot: hi";

  it("marks an inserted block as one added block in place", () => {
    const prev = `${head}\n${turn1}\nUser: what now?`;
    const curr = `${head}\n[Lore: the castle is cursed]\n[Lore: winter has come]\n${turn1}\nUser: what now?`;
    expect(diffPromptText(prev, curr)).toEqual([
      { status: "same", text: head },
      { status: "added", text: "[Lore: the castle is cursed]\n[Lore: winter has come]" },
      { status: "same", text: `${turn1}\nUser: what now?` },
    ]);
  });

  it("marks a truncated head as one dropped block at the top", () => {
    const oldTurns = "User: turn one\nBot: reply one";
    const prev = `${head}\n${oldTurns}\n${turn1}`;
    const curr = `${head}\n${turn1}`;
    expect(diffPromptText(prev, curr)).toEqual([
      { status: "same", text: head },
      { status: "removed", text: oldTurns },
      { status: "same", text: turn1 },
    ]);
  });

  it("reports identical prompts as one same block", () => {
    expect(diffPromptText(head, head)).toEqual([{ status: "same", text: head }]);
  });

  it("shows an edited line as dropped + added — different bytes reached the model", () => {
    expect(diffPromptText("Style: terse.", "Style: florid.")).toEqual([
      { status: "removed", text: "Style: terse." },
      { status: "added", text: "Style: florid." },
    ]);
  });
});
