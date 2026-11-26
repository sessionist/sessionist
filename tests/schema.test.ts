// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// The spec's own sample documents (schema/cases/*.yaml) must validate or fail exactly as recorded,
// and every payload the reader relocates must validate against the schema for its attribute.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { load as parseYaml } from "js-yaml";
import { describe, expect, it } from "vitest";
import { errorsFor, SCHEMA_DIR, type SchemaName } from "../tools/spec-emitter/validate.js";
import { runPipeline } from "./helpers/replay.js";

const CASES_DIR = join(SCHEMA_DIR, "cases");
const SPEC_DIR = join(import.meta.dirname, "..", "fixtures", "spec");

interface SpecCase {
  description: string;
  schema: string; // e.g. gen-ai-input-messages.json
  document: unknown;
  errors: unknown[];
}

describe("the spec's own schema cases", () => {
  const files = readdirSync(CASES_DIR).filter((f) => f.endsWith(".yaml")).sort();
  it("are present", () => {
    expect(files.length).toBeGreaterThanOrEqual(20);
  });
  for (const file of files) {
    const c = parseYaml(readFileSync(join(CASES_DIR, file), "utf8")) as SpecCase;
    const schema = c.schema.replace(/\.json$/, "") as SchemaName;
    const expectValid = c.errors.length === 0;
    it(`${file}: ${expectValid ? "valid" : "invalid"} against ${schema}`, () => {
      const errors = errorsFor(schema, c.document);
      expect(errors.length === 0, errors.join("\n")).toBe(expectValid);
    });
  }
});

describe("relocated payloads validate against the spec schemas", () => {
  const scenarios = readdirSync(SPEC_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  for (const name of scenarios) {
    it(name, () => {
      const r = runPipeline(join(SPEC_DIR, name));
      let checked = 0;
      for (const e of Object.values(r.timelines).flat()) {
        if (e.payload === undefined) continue;
        const p = e.payload as { input?: unknown; output?: unknown };
        const source = e.attrs["sessionist.payload_source"];
        if (source === "gen_ai.input.messages" || source === "log_attributes") {
          const input = p.input as { system_instructions?: unknown; tool_definitions?: unknown; messages?: unknown } | unknown[] | undefined;
          if (Array.isArray(input)) {
            expect(errorsFor("gen-ai-input-messages", input)).toEqual([]);
            checked++;
          } else if (input !== undefined) {
            if (input.messages !== undefined) expect(errorsFor("gen-ai-input-messages", input.messages)).toEqual([]);
            if (input.system_instructions !== undefined) expect(errorsFor("gen-ai-system-instructions", input.system_instructions)).toEqual([]);
            if (input.tool_definitions !== undefined) expect(errorsFor("gen-ai-tool-definitions", input.tool_definitions)).toEqual([]);
            checked++;
          }
          if (p.output !== undefined) {
            expect(errorsFor("gen-ai-output-messages", p.output)).toEqual([]);
            checked++;
          }
        } else if (source === "gen_ai.tool.call") {
          if (p.input !== undefined) expect(errorsFor("gen-ai-tool-call-arguments", p.input)).toEqual([]);
          if (p.output !== undefined) expect(errorsFor("gen-ai-tool-call-result", p.output)).toEqual([]);
          checked++;
        } else if (source === "gen_ai.retrieval") {
          if (p.output !== undefined) expect(errorsFor("gen-ai-retrieval-documents", p.output)).toEqual([]);
          checked++;
        }
      }
      if (name !== "content-by-reference" && name !== "mcp-session") expect(checked).toBeGreaterThan(0);
    });
  }
});
