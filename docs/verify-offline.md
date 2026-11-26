# Verify it yourself: what Sessionist connects to, and what it never does

"Your sessions never leave your machine" is a checkable claim, not a slogan.
Two ways to check it: read the source (it's all here, open source under MIT), or watch
the process's actual network behavior. This page is the second way.

## What you should observe

Every command, `sessionist` (serve), `setup`, `service`, `update`, `list`, `open`,
`export`, `import`, `mcp`, `skill` and `config`, performs **zero network egress on its
own behalf**, with one exception, described below, that the sink makes once a day and
that you can turn off. The sockets you will see are:

| Socket | Direction | What it is |
|---|---|---|
| `127.0.0.1:4318` LISTEN | inbound, loopback only | OTLP receiver (your agent connects to it) |
| `127.0.0.1:4319` LISTEN | inbound, loopback only | Query API + player |
| loopback client connections to the two ports above | local | your browser, the CLI probing the local sink, your agent's exporter |
| one `GET` to `registry.npmjs.org`, from the sink | outbound, at most once a day | the update check: is a newer version published? No body, no custom headers, nothing about you. Off with `sessionist config set updateCheck off` or `--offline`. |

Both listeners bind `127.0.0.1` explicitly — they are not reachable from
other machines.

## How it is enforced, not just promised

There is no component whose job is egress, and the process does not rely on that
being true by inspection. On startup it installs a guard at the one place every
outbound socket in Node passes through: a connection to any address that is not this
machine fails with an ordinary connection error naming the host, before the name is
even looked up. So a dependency that tried to phone home, or a future feature someone
forgot to gate, fails loudly instead of succeeding quietly. The guard is on for every
command; there is no flag to turn it on.

The one request the process makes on its own is the update check. Once a day the
sink asks the npm registry for the newest published version: a `GET`, no body, no
custom headers, so the registry learns nothing it does not already learn from every
`npx sessionist`. The answer is kept in the config file, so a restart does not ask
again, and a failed attempt also waits a day. The MCP server and the CLI commands
never make it. Turn it off with `sessionist config set updateCheck off`; `--offline`
refuses it too, along with any command ever built to reach out on purpose.

There is no telemetry, no crash reporting, and no opt-in that changes any of this
silently. If any other outbound request is ever added, it will be a command you run,
named in the changelog first.

Two things a socket monitor will show that are not this process: `npx` fetching the
package from the npm registry before Sessionist starts, and your browser opening the
viewer after `sessionist open`. Both are other programs talking to their own servers;
neither carries a session.

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
