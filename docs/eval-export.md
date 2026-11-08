# Eval export (`sessionist-eval/v1`)

`sessionist export <id> --eval [--steps a..b]` turns a captured run — usually
a failing one — into a regression case file. Clip the steps where things went
sideways, export, fill in the assertion, commit it to your eval suite.

```sh
sessionist list                      # find the bad run
sessionist export 52cef761… --eval --steps 2..7 --out bad-tool-loop.eval.json
```

## Shape

```json
{
  "format": "sessionist-eval/v1",
  "input": …,          // the first captured input payload in the clip
  "expected": null,     // ALWAYS null — you decide what "correct" is
  "trajectory": [ …SessionEvents, payloads inlined… ],
  "source": {
    "sessionId": "…",
    "steps": "2..7",
    "service": "…",
    "startedAt": "…"
  }
}
```

- `input` — the exact assembled prompt/task the clip started from, verbatim
  from the telemetry. `null` if the clip captured no input payload (never
  synthesized).
- `expected` — always `null`. Sessionist records; it does not judge. The
  human writing the regression test fills in the assertion in their harness's
  terms.
- `trajectory` — the full ordered `SessionEvent` clip (same event shape as
  the [session file format](session-file-format.md)), so a harness or a judge
  can inspect every step the agent took, not just the final answer.
- `source` — provenance back to the session, for the "watch what actually
  happened" link.

## Harness adapters

Concrete adapters (promptfoo, Inspect, Braintrust, …) live in
`src/exporters/` as registry entries beside this one — same input, different
serialization, no core changes. None ship yet; the generic shape above is the
stable interchange until a first adapter lands.
