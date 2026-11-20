# Verify it yourself: Sessionist makes zero network connections

"Your sessions never leave your machine" is a checkable claim, not a slogan.
Two ways to check it: read the source (it's all here, open source under MIT), or watch
the process's actual network behavior. This page is the second way.

## What you should observe

`sessionist` (serve), `list`, `open`, `export`, `import`, `init`, and `mcp`
perform **zero network egress**. The only sockets you will see are:

| Socket | Direction | What it is |
|---|---|---|
| `127.0.0.1:4318` LISTEN | inbound, loopback only | OTLP receiver (your agent connects to it) |
| `127.0.0.1:4319` LISTEN | inbound, loopback only | Query API + player |
| loopback client connections to the two ports above | local | your browser, the CLI probing the local daemon, your agent's exporter |

Both listeners bind `127.0.0.1` explicitly — they are not reachable from
other machines.

There is no component whose job is egress. `--offline` on any command turns
the zero-egress default into a hard guarantee: any attempt to open an outbound
connection fails. There is no telemetry, no crash reporting, and no opt-in that
changes this silently; the only outbound request the tool can ever make is the
documented, disableable update check against the npm registry.

## How to check on macOS

With sessionist running:

```sh
# Every socket the process holds — expect only the two loopback LISTENs:
lsof -p $(pgrep -f "sessionist|dist/cli.js" | head -1) -i

# Watch live traffic by process; sessionist should show zero bytes out
# to any non-loopback address:
nettop -p $(pgrep -f "sessionist|dist/cli.js" | head -1)
```

Or block it outright and observe that nothing breaks:

```sh
# Little Snitch / LuLu: deny all outbound for the node process running
# sessionist. Capture, replay, export — everything keeps working.
```

## How to check on Linux

```sh
ss -tupn | grep "$(pgrep -f sessionist | head -1)"   # expect 127.0.0.1 listeners only
strace -f -e trace=network -p <pid>                   # expect no connect() to non-loopback
```

Or run it in a network namespace with no route to anywhere:

```sh
unshare -n -- sh -c "ip link set lo up && npx sessionist"
```

Everything works identically with no network at all.

## If you see anything else

Any unrequested outbound connection from Sessionist is a **P0 bug**. Capture
the destination (`lsof`/`ss` output) and open an issue — that evidence is
exactly the kind we act on first.
