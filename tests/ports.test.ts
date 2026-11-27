// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// Naming the process on a port goes through lsof, then ss, then gives up honestly; the tools are faked here.

import { describe, expect, it } from "vitest";
import { describeHolder, portHolder, type Capture } from "../src/service/ports.js";

function tools(answers: Record<string, { status: number | null; stdout: string }>): Capture {
  return (cmd) => answers[cmd] ?? { status: null, stdout: "" };
}

describe("portHolder", () => {
  it("names the PID and command from lsof and ps", () => {
    const capture = tools({
      lsof: { status: 0, stdout: "4242\n" },
      ps: { status: 0, stdout: "node /opt/sessionist/dist/cli.js serve\n" },
    });
    expect(portHolder(4318, capture)).toEqual({ pid: 4242, command: "node /opt/sessionist/dist/cli.js serve" });
  });

  it("gives the PID alone when ps cannot describe it", () => {
    const capture = tools({ lsof: { status: 0, stdout: "4242\n" }, ps: { status: 1, stdout: "" } });
    expect(portHolder(4318, capture)).toEqual({ pid: 4242 });
  });

  it("falls back to ss where lsof is missing", () => {
    const capture = tools({
      ss: { status: 0, stdout: 'LISTEN 0 511 127.0.0.1:4318 0.0.0.0:* users:(("node",pid=777,fd=16))\n' },
      ps: { status: 0, stdout: "node x\n" },
    });
    expect(portHolder(4318, capture)).toEqual({ pid: 777, command: "node x" });
  });

  it("is undefined when nothing listens, or no tool can say", () => {
    expect(portHolder(4318, tools({ lsof: { status: 1, stdout: "" } }))).toBeUndefined();
    expect(portHolder(4318, tools({}))).toBeUndefined();
  });
});

describe("describeHolder", () => {
  it("says what it knows and no more", () => {
    expect(describeHolder(4318, { pid: 1, command: "otelcol" })).toBe("port 4318 is held by PID 1 (otelcol)");
    expect(describeHolder(4318, { pid: 1 })).toBe("port 4318 is held by PID 1");
    expect(describeHolder(4318, undefined)).toContain("could not name");
  });
});
