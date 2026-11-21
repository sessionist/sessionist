# The session file format (`sessionist/v1`)

*This specification is MIT-licensed like the rest of the repository (see the root
`LICENSE`), so that anyone may implement the format.*

`*.session.jsonl` is Sessionist's portable session artifact: one agent run,
self-contained, committable to a repo, attachable to a bug report. This
document is the format's public specification. **The format is a public
contract**: changes may only be additive; any rename, removal, or semantic
change requires a new format version string and a migration note here.

## Shape

UTF-8 text, LF line endings, one JSON object per line, no compression (gzip
externally if you like — the file stays valid after gunzip).

- **Line 1 — header:**

  ```json
  {"format": "sessionist/v1", "session": {"id": "…", "startedAt": "…", "endedAt": "…", "service": "…", "eventCount": 21, "status": "ok", "meta": {…}}}
  ```

  `session` fields mirror the Query API's session summary. Optional fields
  (`endedAt`, `service`, `label`) are absent when unknown — never null-padded.
  `meta.sessionist.*` holds assembly provenance (grouping rule, group key, gap
  window, close reason, and `export_range` when the file is a step clip).

- **Every following line — one `SessionEvent`, in `seq` order:**

  ```json
  {"sessionId": "…", "seq": 0, "ts": "2026-08-25T22:41:34.343610880Z", "durationMs": 2524.7, "type": "llm_call", "name": "gpt-4o", "status": "ok", "attrs": {…}, "payload": {"input": …, "output": …}, "provenance": {"traceId": "…", "spanId": "…", "dialect": "otel-genai", "captureMode": "otlp"}}
  ```

  Payloads are inlined in full — the file is self-contained; nothing
  references the exporting machine.

## Field semantics

- `seq` — dense per-session **commit order** (arrival at the receiver), the
  event's identity within the session. It is not necessarily chronological:
  spans export when they end, so a parent often arrives after its children.
  Sort by (`ts`, `seq`) for the narrative order; `seq` order is the forensic
  record of what arrived when, and is the file's line order.
- `ts` — ISO 8601 UTC with 9 fractional digits (lossless OTLP nanoseconds).
  Fixed width: lexicographic order equals chronological order.
- `type` — `agent_start | agent_end | llm_call | tool_call | retrieval |
  handoff | error | user_message | assistant_message | span`. `span` is the
  passthrough type: telemetry no dialect recognized, preserved verbatim.
- `status` — mechanical only (`ok | error | unset`), from the source span
  status. Judgments are not in this file; they live in annotations.
- `attrs` — flat, namespaced. Source namespaces (`gen_ai.*`, `mcp.*`,
  `resource.*`, `otel.*`, anything else the emitter sent) are verbatim;
  everything Sessionist derived is under `sessionist.*` (e.g. `group_rule`,
  `late_arrival`, `payload_source`, `payload_refs`, `derived`). Content
  recognized by a dialect is *relocated* from attrs into `payload` (marked by
  `sessionist.payload_source`) — never duplicated, never dropped. Current
  `payload_source` values: `gen_ai.input.messages` (messages, system
  instructions, and tool definitions from span attributes; `payload.input` is
  the message array, or an object with `messages`, `system_instructions`,
  `tool_definitions` when the latter are present), `log_attributes` (the same
  from a `gen_ai.client.inference.operation.details` log record),
  `gen_ai.tool.call` (tool arguments and result), `gen_ai.retrieval` (query
  text and documents), and `reference` (no inline content; the `gen_ai.*_ref`
  URIs stay in attrs, listed under `sessionist.payload_refs`, and are never
  fetched). New values may be added; readers must not assume the list is closed.
- `provenance` — the link back to the wire: trace/span ids, which dialect
  normalized it, and the capture mode (`otlp`; `proxy` marks partial captures
  written by versions that shipped the pass-through proxy, and still imports).

## Round-trip guarantee

`sessionist export` then `sessionist import` on a fresh machine, then
`sessionist export` again produces a **byte-identical** file (tested in
`tests/roundtrip.test.ts`). To keep this property:

- Field order in each line is canonical (the order shown above); `attrs`,
  `payload`, and `meta` preserve their own key order through parse/stringify.
- Import stores header values verbatim — counts and status are never
  recomputed from events.
- Sessions are immutable: importing an id that already exists is an error,
  never an overwrite.

## The HTML container (`*.session.html`)

`sessionist export <id> --html` wraps the session file in a single
self-contained HTML page: the full player bundle inlined, plus the
`.session.jsonl` content embedded as a gzip+base64 blob in
`<script id="sessionist-session" type="application/gzip+base64">`. It opens
from `file://` in any browser and makes **zero network requests** — no
external scripts, fonts, stylesheets, or fetches (CI asserts this by
rendering it with all DNS resolution blackholed).

The HTML is a *container, not a second format*: the embedded session file is
the contract, extractable byte-equal, and `sessionist import file.session.html`
unwraps it and imports exactly as if given the `.jsonl`. It is deliberately a
snapshot — no live updates, no comments, no permalink.

## Version history

- `sessionist/v1` — initial format (2026-08).
