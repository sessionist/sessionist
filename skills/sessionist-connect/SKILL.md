---
name: sessionist-connect
description: Point an AI agent's OpenTelemetry exporter at a local Sessionist sink and verify one real run landed. Use when the user says "connect my agent to sessionist", "wire sessionist", "add sessionist", "sessionist is empty", or "no sessions are showing up". For initial setup only — a repo whose exporter already points at the sink needs no changes.
---

<!-- SPDX-License-Identifier: MIT
     Copyright (c) 2026 Sessionist -->

You are wiring the user's AI agent so its next run appears in Sessionist. Sessionist is a local
OpenTelemetry sink: it listens, stores, and shows. It does not run the agent and it has no SDK.

The agent's own framework already emits OpenTelemetry. Your job is to add **one exporter** to the
telemetry the repo already owns, run the agent once, and prove a useful session landed. Nothing
else.

## Hard rules

- **Never install a Sessionist package.** There is none to install. Sessionist is a sink reached
  by URL.
- **Never install or upgrade an OpenTelemetry package, or any other dependency.** If the repo has
  no OpenTelemetry at all and its framework does not emit the GenAI conventions, stop and hand
  off (see Blocked). Adding instrumentation to an uninstrumented app is not this skill's job.
- **Never create a second tracer provider.** If the repo already initializes OpenTelemetry,
  Sentry, Datadog, Honeycomb, or Langfuse, add an exporter to that setup and leave it owning
  telemetry.
- **Never edit before saying what you will change.** One or two sentences: the file, the change,
  and how risky it is.
- **Never invent a value the telemetry does not carry.** No placeholder service names, no guessed
  ports, no fabricated conversation ids.
- **Never say "wired" without a session you have read.** If verification fails, report the exact
  evidence.
- Report briefly as you go: one or two sentences per phase, naming what you found and what is
  next. Do not research silently for minutes.

## Phase 0: orient (read only)

Four questions, answered before any edit.

**1. Is the sink running?**

```bash
curl -fsS http://127.0.0.1:4319/api/health
```

The Query API is on port 4319 and the OTLP receiver on 4318. Ask the user for the base URL if
the sink runs on another host or on non-default ports, and use their URLs everywhere below. No
response: tell the user to run `npx sessionist` in another terminal, and stop.

**2. Is this repo already wired?**

Search the repo for the sink's OTLP URL, for `OTEL_EXPORTER_OTLP_ENDPOINT`, and for any exporter
whose URL resolves to the sink's host and port. Check `.env` files and the run command's
environment too, since the endpoint is often set outside the code.

Already pointing at the sink: **stop**. Say so, give the command that runs the agent, and tell
the user the next run will appear in Sessionist. Make no edits. This is the common case on a
second invocation and it is a success, not a failure.

**3. Who owns telemetry in the process that runs the agent?**

- **eve**: look for `otelIntegration()` in the agent definition. Before writing anything, read
  the installed documentation in `node_modules/eve/docs/` for the exporter and trace-policy
  option names. The installed docs match the installed version; do not use option names from
  memory, including any in this file.
- **Another framework that emits the current OTel GenAI conventions** (message content as
  `gen_ai.input.messages` / `gen_ai.output.messages` span attributes): find where its exporter
  or OTLP endpoint is configured.
- **A plain OpenTelemetry setup** (`NodeSDK`, `TracerProvider`, a tracing bootstrap file): find
  the initializer that actually runs in the agent's process, not one in a sibling app.
- **Nothing**: stop and hand off. See Blocked.

**4. What command runs one representative invocation locally?**

Ask only if it is not obvious from the package scripts or the README.

Timebox this phase. If discovery is not converging, report what you know and ask one concrete
question.

## Phase 1: the smallest change

Two edits at most.

**The exporter.** Add one OTLP HTTP exporter pointed at the sink's receiver
(`http://127.0.0.1:4318` by default) to the telemetry setup you found. Both protobuf and JSON
are accepted. If the repo configures its endpoint through `OTEL_EXPORTER_OTLP_ENDPOINT`, set
that; otherwise add the exporter in code beside the existing one. Keep every existing exporter:
Sessionist is a layer beside the user's backend, not a replacement.

**Content capture.** Payloads are the point: without them the session shows that a model was
called but not what it was asked. Some frameworks capture message content only when a trace
policy turns it on (eve's default is off). If content capture is off, **ask the user before
turning it on**, in one sentence: the full prompts, tool arguments, and tool results will be
recorded into the local sink at `~/.sessionist`. It is their content and their decision. If they
decline, continue without it and say in the handoff that payloads will be absent.

Confirm the conversation id. The convention's `gen_ai.conversation.id` is what groups a run into
one session; eve stamps it already. If nothing stamps it, note it: the session will still form
from an idle-gap window and Sessionist labels it as such.

No package installs. No version bumps. No second provider. No new env-var indirection if the
repo does not already use one.

## Phase 2: run once, then verify over MCP

Run the command from phase 0, or ask the user to run it.

Then verify with the Sessionist MCP tools. If they are not available, tell the user to run
`claude mcp add sessionist -- npx sessionist mcp` and restart, or verify in the viewer at
`http://127.0.0.1:4319` instead. Four calls:

1. **`list_sessions`** with `since` set to just before the run. Expect exactly one new session.
   None: the run did not reach the sink. Go to Troubleshooting.
2. **`get_session`** on it. Read the compact timeline and check:
   - an agent bracket (`agent_start` / `agent_end`) if the framework emits `invoke_agent`,
   - at least one `llm_call` with a payload ref,
   - each `tool_call` carrying an id,
   - whether the session was grouped by conversation id or by time window,
   - which steps are passthrough spans.
3. **`get_event_payload`** on the first `llm_call`. Expect the system instructions and the
   message array the model received. Empty or absent: content capture is off. Return to phase 1.
4. **Report the passthrough spans by name.** The user decides whether they are expected. Anything
   their framework emits outside the GenAI conventions is an issue to file against that
   framework, never a change to the agent's code to please the sink.

Describe what you found as what happened, not as ids. Session ids and step numbers are handles
for tool calls, not for the user.

## Troubleshooting

In order, stopping at the first that explains it.

- **No session at all.** Did the command actually exercise the instrumented entry point? Did the
  process receive the endpoint configuration? Short-lived processes must flush or shut down the
  tracer provider before exit, or the batch never leaves.
- **The session exists but has no model calls.** The exporter is attached to a provider that the
  agent's code does not use. Confirm the running process initializes the setup you edited.
- **Model calls with no payloads.** Content capture is off, or the framework emits an older
  content generation. Older generations are preserved verbatim as passthrough attributes and are
  not interpreted; the inspector shows them, and the fix belongs upstream.
- **Steps appear twice.** Two instrumentations are covering the same operation. Sessionist records
  both as sent and never deduplicates. Remove one instrumentation if the user wants one.
- **The sink is unreachable mid-run.** Say the sink is down. Do not call the work wired.

If none of these explains it, stop and report the exact evidence: what you edited, what you ran,
and what the tools returned. Do not add more instrumentation to compensate.

## Handoff

Pick one, and never the first without a session you read.

**Verified:**

> Wired. One run is in Sessionist: `<what the session shows, in a sentence>`. The viewer is at
> http://127.0.0.1:4319, and I can read any session over MCP from here.

**Needs the user to run it:**

> Wired. Run `<command>`; the next run will appear at http://127.0.0.1:4319. If it stays empty,
> tell me and I will check why.

**Blocked:**

> I stopped before guessing. `<the specific ambiguity or failure>`. The next step is `<the
> smallest user choice>`.

For a repo with no OpenTelemetry and a framework that does not emit the GenAI conventions:

> This repo has no OpenTelemetry setup for me to add an exporter to, and `<framework>` does not
> emit the OpenTelemetry GenAI conventions. Sessionist reads that one wire format and adds no SDK
> of its own, so there is nothing for me to point at the sink. Instrumenting `<framework>` with
> OpenTelemetry first is a separate decision; the docs at docs/README.md say what Sessionist
> needs to see.
