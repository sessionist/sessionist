<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/sessionist-lockup-horizontal-white.svg">
    <img src="docs/assets/sessionist-lockup-horizontal-black.svg" width="420" alt="sessionist">
  </picture>
</p>

**A flight recorder for your agent.**

Sessionist records every run your agent makes, on your machine, as it happens: every prompt, every tool result, every reply, exactly as they were. Your coding agent reads the recording over MCP and answers from what actually happened.

```
npx sessionist          # starts the recorder; offers to attach your coding agent
/sessionist-connect     # in your agent's repo: points it here, verifies one run
```

That's it. The next run is recorded as your agent makes it.

> **You:** why did the weather agent answer the way it did in its last run?
>
> **Your coding agent:** It called `get_weather` for Paris because the system prompt required a tool call for conditions. The tool returned `rainy` and `57` with no unit preference, and the second model call turned those two fields into "It's rainy in Paris, 57°F." If that's wrong for Paris, the tool is wrong, not the model.

Four tool calls. No re-running the agent, no guessing from the code.

## How it works

Your agent, or the framework under it, already emits OpenTelemetry. Point its exporter at `localhost:4318`. Sessionist stores each run as a session in SQLite on your machine and serves it three ways: to your coding agent over MCP, to you in a local viewer, and to anyone as a portable file.

No SDK. No account. No cloud flag. Nothing leaves your machine.

It reads the current OpenTelemetry GenAI conventions, the format the official instrumentations and modern agent frameworks emit. Anything else is kept verbatim as a plain step, never dropped and never guessed at. The recording is immutable: there is no edit button, because the point is evidence.

## Your coding agent

Any MCP client can read recordings. `sessionist setup` registers the server with Claude Code; `sessionist setup --print` gives the config block for other agents. The server hands the agent its own reading instructions on connect, so there is nothing to install to read.

One skill ships with the package: `/sessionist-connect` finds whatever already owns telemetry in your agent's repo, adds one exporter pointed at the recorder, asks before turning on content capture, runs the agent once, and reads the session back to prove it landed. It installs nothing and leaves an already-connected repo alone.

## Keeping it recording

The recorder is a plain process, and a run that happens while it is stopped is lost. `sessionist service install` starts it at login instead, a LaunchAgent on macOS or a systemd user service on Linux. It relaunches after a crash but never after you stop it on purpose. `sessionist service status` tells you whether it is installed, loaded, and actually answering, which are three different things.

## The viewer

A timeline of the whole run with errors marked, a step inspector showing each step's exact input and output, and a diff of what changed in the model's context since the previous call. Live sessions append as they happen. Any step deep-links.

## Privacy

Everything stays on your machine. There is no account, no telemetry, and no phone-home. The current release makes no network connections at all, and `--offline` enforces that for the process. The HTML export loads nothing from anywhere. If any of this changes in a future release, it will be documented here first, never quietly. You can check it yourself with a firewall or socket monitor: [docs/verify-offline.md](docs/verify-offline.md). The session file format is public and versioned, with a byte-equal round trip, so your data is yours in a format you can read with `cat`.

## Contributing

Open source, closed development: the source is public so you can audit exactly what a tool that records your prompts is doing, and we don't accept code pull requests. What we want is bug reports with the raw OTLP batch attached; the batch is the evidence, and the test harness replays it against the reader. If a framework emits something the conventions do not define, the fix belongs upstream, and we will say so with the attribute names.

[MIT](LICENSE). The Sessionist name and mark are covered separately by [TRADEMARK.md](TRADEMARK.md).

MIT © 2026 Sessionist.
