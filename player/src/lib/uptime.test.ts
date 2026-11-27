// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

import { describe, expect, it } from "vitest";
import { formatUptime } from "./uptime";

describe("formatUptime", () => {
  it("rounds down to the unit a person reads", () => {
    expect(formatUptime(0)).toBe("under a minute");
    expect(formatUptime(59_000)).toBe("under a minute");
    expect(formatUptime(60_000)).toBe("1 min");
    expect(formatUptime(59 * 60_000 + 59_000)).toBe("59 min");
    expect(formatUptime(60 * 60_000)).toBe("1 h");
    expect(formatUptime(47 * 3_600_000)).toBe("47 h");
    expect(formatUptime(48 * 3_600_000)).toBe("2 d");
    expect(formatUptime(1_070_388_828)).toBe("12 d");
  });
});
