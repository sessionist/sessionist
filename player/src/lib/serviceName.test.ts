// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

import { describe, expect, it } from "vitest";
import { serviceFace } from "./serviceName";

describe("serviceFace", () => {
  it("shows a real service name as sent, with no tooltip", () => {
    expect(serviceFace("dawling-agent")).toEqual({ text: "dawling-agent", unnamed: false });
  });

  it("names an absent service.name as unnamed", () => {
    const face = serviceFace(undefined);
    expect(face.text).toBe("unnamed service");
    expect(face.unnamed).toBe(true);
    expect(serviceFace("").unnamed).toBe(true);
  });

  it("treats the SDK default as unnamed and keeps the value as sent in the tooltip", () => {
    const sent = "unknown_service:/home/me/.nvm/versions/node/v25.6.1/bin/node";
    const face = serviceFace(sent);
    expect(face.text).toBe("unnamed service");
    expect(face.unnamed).toBe(true);
    expect(face.tooltip).toContain(sent);
    expect(face.tooltip).toContain("OTEL_SERVICE_NAME");
  });

  it("treats the bare SDK default as unnamed", () => {
    expect(serviceFace("unknown_service").unnamed).toBe(true);
    expect(serviceFace("unknown_service:node").unnamed).toBe(true);
  });

  it("does not mistake a real name that merely starts with the prefix", () => {
    expect(serviceFace("unknown_service_monitor").unnamed).toBe(false);
    expect(serviceFace("unknown_services")).toEqual({ text: "unknown_services", unnamed: false });
  });
});
