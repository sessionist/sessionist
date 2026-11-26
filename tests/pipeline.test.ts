// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// Replays every scenario under fixtures/spec/ through the full pipeline and snapshots the
// resulting sessions and timelines; the fixture directories must match the scenario list.

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runPipeline } from "./helpers/replay.js";
import { SCENARIOS } from "../tools/spec-emitter/scenarios.js";

const SPEC_DIR = join(import.meta.dirname, "..", "fixtures", "spec");

const fixtureSets = existsSync(SPEC_DIR)
  ? readdirSync(SPEC_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(join(SPEC_DIR, entry.name, "batches")))
      .map((entry) => entry.name)
      .sort()
  : [];

describe("pipeline over the spec corpus", () => {
  it("has one recorded fixture set per scenario, no more, no fewer", () => {
    expect(fixtureSets).toEqual(SCENARIOS.map((s) => s.name).sort());
  });

  for (const name of fixtureSets) {
    describe(name, () => {
      const result = runPipeline(join(SPEC_DIR, name));

      it("assembles at least one session with events, all closed", () => {
        expect(result.sessions.length).toBeGreaterThanOrEqual(1);
        for (const session of result.sessions) {
          expect(session.eventCount).toBeGreaterThan(0);
          expect(session.status).not.toBe("running"); // sweep closed everything
        }
      });

      it("matches the sessions snapshot", () => {
        expect(result.sessions).toMatchSnapshot("sessions");
      });

      it("matches the timelines snapshot", () => {
        expect(result.timelines).toMatchSnapshot("timelines");
      });
    });
  }
});
