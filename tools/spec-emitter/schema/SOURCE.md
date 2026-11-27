# Vendored from the OpenTelemetry GenAI semantic conventions

Source repository: https://github.com/open-telemetry/semantic-conventions-genai
Pinned commit: `41aad2b16ab1725eb618c5e9a0b82433e9b1c170` (2026-10-30)

- `gen-ai-*.json` — `model/gen-ai/*.json`, the JSON schemas for the content
  attributes (`gen_ai.input.messages`, `gen_ai.output.messages`,
  `gen_ai.system_instructions`, `gen_ai.tool.call.arguments`,
  `gen_ai.tool.call.result`, `gen_ai.tool.definitions`,
  `gen_ai.memory.records`, `gen_ai.retrieval.documents`).
- `cases/*.yaml` — `docs/gen-ai/non-normative/tests/cases/*.yaml`, the spec's
  own sample documents with the validation errors each schema reports.

Re-pinning is a deliberate change in its own commit, never automatic: update
the commit here, re-download both sets, run the suite, and
re-check the scenario list in `tools/spec-emitter/scenarios.ts` against the
span tables and the `gen_ai.operation.name` enum.

These files are the specification's and carry its license (Apache-2.0).
