// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// The server-level `instructions` string handed to the client on connect; keep it in step with the tool descriptions in server.ts.

export const MCP_INSTRUCTIONS = `Sessionist is a local sink holding recorded sessions of the user's AI agent: every model call with the exact input it received and the output it returned, every tool call and result, every span the framework emitted, as recorded. The store is read-only and immutable. Nothing here runs or re-runs the agent.

When the user asks why their agent did something — a wrong answer, a tool that misfired, a run that stalled — read the session before re-reading the source. The source says what the agent was allowed to do; the session says what it did.

Read in this order, stopping as soon as you can answer:

1. list_sessions — which run? Always bound it: status "error", a since/until window, or text to search payloads. Never list unbounded.
2. get_session — what happened in that run? A compact timeline: one line per step with seq, type, name, status, duration, and payload size. Read it to find the step that matters and note its seq. Leave include_attrs off until one specific step needs it.
3. get_event_payload — what exactly did the model see, or the tool return? One step's body, by seq. Bodies are capped: truncated:true with totalBytes means raise max_bytes for the step that matters, not for the whole session. To see what changed in the model's context between two calls, read the input payload of each llm_call and compare.
4. search_sessions — did this string appear anywhere? Full-text across names and payloads when you do not yet know the run or the step.
5. export_session — hand the run to someone, or to a later session. The session-file exporter writes portable JSONL that any agent reads with no server running; eval-generic writes a regression case with the expected output left null for a human. Large sessions come back as stats plus the shell command to run instead.
6. reads_summary — how much has been read from this store, by whom, how many bytes: the human's odometer. Rarely useful while investigating a run; it exists so everything the viewer shows is also readable here.

A typical question takes three or four calls: one list, one timeline, then only the one or two payloads the answer hinges on. Do not list again to survey the store, and do not read every payload in a run; pick the step the question is about.

How to report what you find:

- Translate to what happened. Session ids, seq numbers, and millisecond timestamps are handles for tool calls, not for the user. Say "the retrieval tool returned an empty list, and the next prompt still claimed three sources", not which seq held it.
- Never invent a value the telemetry did not carry. If a field is absent, say the telemetry does not carry it. Absence is data: this sink never fills gaps with defaults.
- When you quote a payload that came back truncated, say it was truncated.
- Unrecognized spans are preserved verbatim as passthrough steps and are never interpreted. Read their attributes as evidence; do not assume a meaning the convention does not define.
- A session grouped without a conversation id is labeled as such, and its boundaries come from an idle gap rather than the framework. Treat the grouping as approximate when reasoning about what belonged to one run.`;
