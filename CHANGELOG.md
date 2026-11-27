# Changelog

Every release, newest first. The public repository is a snapshot of each release with no history between them, so this file is the record. Each entry ends with a **Contracts** line naming what a client depends on: the Node range, the store schema (`PRAGMA user_version`), the session file format, and the MCP tool list. When one of them changes, that line says so in the release that changed it.

## Unreleased

## 0.1.5 — 2026-11-27

### Changed

- A sink whose login service runs a fixed path (a global install, a checkout) can now update itself from the viewer when the package on disk beside the script the service runs is newer than the running process, since a restart then starts that code. Previously only a service run from the npx cache could; a global install after `npm i -g sessionist@latest`, or a checkout after a build, was told to run the command it had just run. When disk and process agree, the command is still shown. `/api/health` `update.onDisk` carries the on-disk version in that case.

**Contracts:** Node >= 22.16, store schema 4, session file `sessionist/v1`, seven MCP tools, all unchanged. `/api/health` `update` gains the optional `onDisk` field.

## 0.1.4 — 2026-11-26

### Changed

- The process refuses any connection to an address that is not this machine, by construction: every outbound socket is checked at the one place Node opens them, before the name is looked up, and a refusal is an ordinary connection error naming the host. Previously zero egress was true by inspection of the code, and `--offline`, documented as a hard guarantee, was accepted and did nothing. The flag remains accepted and now means one more thing: the update check below, and any command built to reach out on purpose, are refused too.

### Added

- The one request the sink makes on its own: once a day it asks the npm registry for the newest published version, a read-only GET with no body and no custom headers, so the registry learns nothing it does not already learn from `npx sessionist`. The answer is kept in config, so a restart does not ask again; a failed attempt also waits a day. Off with `sessionist config set updateCheck off`, or with `--offline`. The check never runs from the MCP server or a CLI command, and never before the ports are bound.
- The viewer shows a newer release beside the sink's version and offers the one action that gets there: a restart of the login service, which from the npx cache starts the newest release. It refuses while a run is recording, in the same words as `sessionist update`, with "restart anyway" as the override. Where a restart would not bring new code (a global install, a checkout, no login service), it shows the command to run instead, and never says "up to date", since a check can be a day old.
- `POST /api/update`, the first endpoint that changes anything: it requires the viewer's own header and a loopback origin, so a page on another site cannot restart your sink, and it sends no CORS header. `/api/health` carries `update` (`checksEnabled`, `checkedAt`, `latest`, `available`, `canSelfUpdate`, and a `reason` and `command` when the sink cannot update itself), and `sessionist_info` passes it through.

### Fixed

- `docs/verify-offline.md` named a command that was removed in October and an update check that was never built. It now describes the guard, and the two connections a socket monitor will show that are not this process: `npx` fetching the package, and the browser opening the viewer.

**Contracts:** Node >= 22.16, store schema 4, session file `sessionist/v1`, seven MCP tools, all unchanged. `/api/health` gains `update`; `POST /api/update` is new, the only non-GET route; config gains `updateCheck` (default on), `updateCheckedAt` and `updateLatest`. The egress promise changes from "no update pings" to one daily read-only request to the npm registry, off by config or `--offline`.

## 0.1.3 — 2026-11-26

### Changed

- `sessionist setup` and `sessionist service install` check their own outcome. A service told to start is reported as listening, with the sink's port, version and PID, or as loaded with nothing answering and where to look. When a port is already held, the service is registered but not started, and the report names the process holding the port: a Sessionist sink started from a shell, with the warning that nothing records after it exits until the next login and how to hand over now; or a stranger, with the config key to change. Previously a bind-failing service was retried forever and a deferred one said only "will start at your next login".
- `sessionist setup` re-points a user-scope MCP registration that names a different install (another path, or `npx` beside a global copy), so the reader and the sink are the same build, and says what it was. A matching registration is left alone, and so is one at project or local scope.
- `sessionist mcp` exits when its client closes the pipe or goes away, so a session that ends without cleaning up leaves no orphan server holding the store.
- `sessionist service status` names the sink's version and PID when listening, and the process holding either port when not.
- The store uses Node's built-in SQLite (`node:sqlite`). The package has no native code any more: nothing is prebuilt, downloaded or compiled at install, so an Xcode or Python toolchain is never involved. Node 22.16 or newer is required (was 20): Node's bundled SQLite gained full-text search (FTS5) in 22.16.0, and the search table needs it. On an older Node the sink and the MCP server refuse to start with a message naming the version. Node 20 reached end of life in April 2026. Existing stores open unchanged; fixture replay throughput is the same as before.
- `list_sessions` answers carry `store`: how many sessions the whole store holds and when the newest started. An empty page under a filter now reads differently from an empty store.
- Every step with relocated content now carries `sessionist.relocated_attrs`, the exact attribute keys that were moved into the payload. The existing `sessionist.payload_source` is a category, not a key: it reads `gen_ai.input.messages` whenever any of input messages, output messages, system instructions or tool definitions moved, so a span carrying only output messages was labelled as input messages. The exact list was computed and then discarded; it is now stored. Older sessions keep only the category. No placeholder values are put into `attrs`.
- The MCP instructions and the `get_session` description say where content attributes go: into the step's payload, with `sessionist.relocated_attrs` listing the keys. A content key missing from `attrs` was relocated, not left uncaptured.

### Added

- `sessionist_info`, a seventh MCP tool: this reader's version and PID, whether the sink is listening and on which version and PID, where the store is and how many sessions and events it holds at which schema version, whether the login service is installed and loaded, the MCP servers that read the store in the last 24 hours by client and PID with whether each is still alive and which is this one, and the version note when reader and sink differ. Everything the terminal banner shows, for a client that cannot see the terminal. Not counted in reads. `/api/health` carries the same store block plus the sink's PID and ports, so the viewer and the MCP server read the same facts.
- The reads table records the PID of the MCP server that answered (store schema 4, one added column). A reader on an older sink's store still counts its reads, without the PID, since a reader never migrates a store it does not own.
- This changelog, shipped in the package so an installed copy can be asked what changed. Publishing a version without an entry here is refused.

### Removed

- The `better-sqlite3` dependency, the only native module. Runtime dependencies go from four to three.

**Contracts:** Node >= 22.16 (was >= 20). Store schema 4 (was 3): `reads.pid INTEGER`, additive; a schema-3 store opens unchanged under the new MCP server. Session file `sessionist/v1`; events gain the attr `sessionist.relocated_attrs` (additive, in the open `sessionist.*` namespace). MCP tools: `sessionist_info` added, the six others unchanged; the `list_sessions` response gains the `store` field. `/api/health` gains `pid`, `otlpPort`, `apiPort` and `store`.

## 0.1.2 — 2026-11-21

### Added

- `sessionist update` restarts the login service on the newest release and refreshes the installed `/sessionist-connect` skill, printing the sink's version before and after. It refuses while a session is still recording unless `--now` is passed, since a restart drops what arrives meanwhile.
- When the MCP server and the sink are different versions, the MCP server says so in the instructions it hands the coding agent, naming both versions and the fix. Nothing is said when they agree or the sink is not running, and nothing is checked anywhere but localhost.

### Changed

- The MCP server never migrates an existing store; the sink that owns the file may be an older version still writing to it.

No registry check, no self-restart, no telemetry: `npx sessionist` already resolves the newest release each time it starts, so the MCP server is current at every coding-agent session and the sink is current from its next start.

**Contracts:** Node >= 20. Store schema 3. Session file `sessionist/v1`. MCP tools unchanged.

## 0.1.1 — 2026-11-20

### Fixed

- `--help`, `-h`, `--version` and `-v` answer before anything binds a port, and each command answers `--help` with its own usage; `sessionist --help` no longer starts serving.
- With no terminal attached, `npx sessionist` says that it is a foreground sink and names `setup`, which attaches the reader, starts the sink at login, and exits; `--yes` attaches without asking and keeps serving.
- The login service unit runs the absolute `npx` with `-y` and carries a PATH, so the sink starts at login from the npx cache.

### Changed

- The viewer shows a run whose process never set `service.name` as "unnamed service" (the OpenTelemetry SDK's `unknown_service:<executable>` fallback), with the value as sent in a tooltip and the agent's own name beside it when the framework sent one. The stored value is unchanged.
- The connect skill checks that the agent's process sets `OTEL_SERVICE_NAME`, or `service.name` on its resource, alongside the exporter edit.

**Contracts:** Node >= 20. Store schema 3. Session file `sessionist/v1`. MCP tools unchanged.

## 0.1.0 — 2026-11-08

First release.

- OTLP receiver on `127.0.0.1:4318`: traces and logs, protobuf and JSON, gzip accepted. Reads the current OpenTelemetry GenAI conventions; everything else is kept verbatim as passthrough steps.
- SQLite store under `~/.sessionist`, write-once events, full-text search over payloads, large payloads spilled to content-addressed blobs.
- Viewer on `127.0.0.1:4319`: timeline, step inspector, context diff between model calls, live updates, and the reads odometer.
- MCP server over stdio with six read-only tools: `list_sessions`, `get_session`, `get_event_payload`, `search_sessions`, `export_session`, `reads_summary`. The reading order ships as the server's instructions.
- `sessionist setup` registers the MCP server with Claude Code, installs the `/sessionist-connect` skill, and starts the sink at login (launchd on macOS, systemd user unit on Linux).
- `sessionist export`: the `.session.jsonl` file (lossless, byte-equal round trip), a self-contained `.session.html` replay, and a generic eval case. `sessionist import` reads the first two back.
- `--offline` hard-disables all network egress. No telemetry, no accounts, no update pings.

**Contracts:** Node >= 20. Store schema 3. Session file `sessionist/v1`. MCP tools: the six above.
