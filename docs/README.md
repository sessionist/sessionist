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

Node 22.16 or newer. The store is Node's built-in SQLite, so the package has no native
code: nothing is prebuilt, downloaded or compiled at install, and no Xcode or Python
toolchain is ever involved. The floor is 22.16 because Node's bundled SQLite carried no
full-text search (FTS5) before that release; on an older 22.x the sink refuses to start
and says so, naming the version it needs.

Starting at login matters because the sink is otherwise a plain foreground process: a
span sent while it is stopped is lost, and the refusal shows up in your agent rather
than here. `sessionist service install` writes a LaunchAgent on macOS or a systemd user
unit on Linux, enables lingering on Linux so the service survives logout on a headless
machine, and relaunches on crash but never after a deliberate stop. `service status`
separates installed, loaded, and listening, naming the sink's version and PID when it
answers and the process holding a port when it does not. An install checks its own
outcome: a started service is reported as listening or as loaded with nothing answering;
a port already held by a shell-started sink, or by something else, is named, and the
service is registered without being started. Windows has no equivalent and says so.

The offer is made only when a terminal is attached. In a coding agent's shell, CI, or a
pipe there is nobody to ask, so nothing is attached and the sink says so and keeps
serving in the foreground. A coding agent should run `npx -y sessionist setup` instead:
it attaches everything, starts the sink at login, and exits. `sessionist --yes` attaches
without asking and keeps serving; `setup --print` emits the config block for a coding
agent with no CLI of its own; `--no-setup` skips the offer. A declined prompt is
remembered. `sessionist --help`, `--version`, and `<command> --help` answer and exit
without touching the ports.

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
