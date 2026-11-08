# Sessionist docs

## Connect

Sessionist reads the current OpenTelemetry GenAI conventions: `gen_ai.operation.name`
for structure (`invoke_agent`, `chat`, `execute_tool`) and `gen_ai.input.messages` /
`gen_ai.output.messages` span attributes for content. Point the exporter at
`http://127.0.0.1:4318` (protobuf or JSON). Spans from older content-capture
generations and from other namespaces are preserved verbatim as passthrough steps,
never dropped and never interpreted.

The install is two steps:

```
npx sessionist          # starts the sink; offers once to attach your coding agent
/sessionist-connect     # in the agent's repo
```

Step one registers the MCP server with Claude Code (at user scope, by calling that
tool's own CLI rather than editing its config), installs the skill, and offers to start
the sink at login, all after asking.

Starting at login matters because the sink is otherwise a plain foreground process: a
span sent while it is stopped is lost, and the refusal shows up in your agent rather
than here. `sessionist service install` writes a LaunchAgent on macOS or a systemd user
unit on Linux, enables lingering on Linux so the service survives logout on a headless
machine, and relaunches on crash but never after a deliberate stop. `service status`
separates installed, loaded, and listening. Windows has no equivalent and says so.

`sessionist setup` does it explicitly, `setup --print` emits the config block for a
coding agent with no CLI of its own, and `--no-setup` skips the prompt. A declined
prompt is remembered.

Two ways to wire the agent itself:

- **Let the coding agent do it.** Run `/sessionist-connect` in the agent's repo. It adds one
  exporter to whatever already owns OpenTelemetry there, asks before enabling content
  capture, runs the agent once, and verifies the session over MCP. It installs no packages
  (there is no Sessionist SDK), never creates a second tracer provider, and leaves an
  already-connected repo alone. `sessionist skill print` emits the text for coding agents
  that store skills elsewhere.
- **By hand.** Add the exporter URL yourself. For eve, set a trace policy that captures
  content; eve stamps the conversation id already.

Reading a session needs no skill: `sessionist mcp` carries the reading order as its own MCP
instructions.

- eve: a dedicated quickstart is in progress (`quickstart-eve.md`).

## Formats

- [session-file-format.md](session-file-format.md) — the portable
  `*.session.jsonl` artifact (`sessionist/v1`) and its `*.session.html`
  container (the full player in one file, offline). A public contract with a
  byte-identical round-trip guarantee.
- [eval-export.md](eval-export.md) — exporting a captured run as a regression
  case (`sessionist-eval/v1`).
- [../fixtures/README.md](../fixtures/README.md) — the test corpus: 22 OTLP
  recordings generated from the GenAI conventions, MIT like the rest, so any
  tool can test against them.

## Privacy

- [verify-offline.md](verify-offline.md) — how to confirm with a firewall or
  socket monitor that Sessionist makes zero network connections, and what
  `--offline` guarantees.
