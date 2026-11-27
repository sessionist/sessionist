// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// Validation against the spec's own JSON schemas (schema/SOURCE.md): the emitter refuses to put
// a content attribute on a span unless its document validates.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Ajv } from "ajv";
import type { ValidateFunction } from "ajv";

export const SCHEMA_DIR = join(import.meta.dirname, "schema");

export type SchemaName =
  | "gen-ai-input-messages"
  | "gen-ai-output-messages"
  | "gen-ai-system-instructions"
  | "gen-ai-tool-call-arguments"
  | "gen-ai-tool-call-result"
  | "gen-ai-tool-definitions"
  | "gen-ai-memory-records"
  | "gen-ai-retrieval-documents";

/** The attribute each schema governs. */
export const SCHEMA_FOR_ATTR: Record<string, SchemaName> = {
  "gen_ai.input.messages": "gen-ai-input-messages",
  "gen_ai.output.messages": "gen-ai-output-messages",
  "gen_ai.system_instructions": "gen-ai-system-instructions",
  "gen_ai.tool.call.arguments": "gen-ai-tool-call-arguments",
  "gen_ai.tool.call.result": "gen-ai-tool-call-result",
  "gen_ai.tool.definitions": "gen-ai-tool-definitions",
  "gen_ai.memory.records": "gen-ai-memory-records",
  "gen_ai.retrieval.documents": "gen-ai-retrieval-documents",
};

// `format: binary` is not an ajv format and the spec defines none, so formats are not validated;
// `strict: false` because the schemas use `default` and `deprecated`, which ajv would otherwise flag.
const ajv = new Ajv({ strict: false, validateFormats: false, allErrors: true });
const compiled = new Map<SchemaName, ValidateFunction>();

export function validatorFor(name: SchemaName): ValidateFunction {
  const cached = compiled.get(name);
  if (cached !== undefined) return cached;
  const schema = JSON.parse(readFileSync(join(SCHEMA_DIR, `${name}.json`), "utf8")) as object;
  const fn: ValidateFunction = ajv.compile(schema);
  compiled.set(name, fn);
  return fn;
}

/** Error strings in ajv's `instancePath message` form; empty when valid. */
export function errorsFor(name: SchemaName, doc: unknown): string[] {
  const fn = validatorFor(name);
  if (fn(doc)) return [];
  return (fn.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message ?? ""}`.trim());
}

export function assertValid(name: SchemaName, doc: unknown): void {
  const errors = errorsFor(name, doc);
  if (errors.length > 0) {
    throw new Error(`document does not validate against ${name}:\n  ${errors.join("\n  ")}`);
  }
}
