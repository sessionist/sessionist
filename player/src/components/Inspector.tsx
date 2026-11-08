// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// Step inspector: input/output, attrs, timing, and provenance for one event; large payloads load on demand.

import { useEffect, useState } from "react";
import { getPayload, type EventPayload, type TimelineEvent } from "../api";
import {
  diffMessageArrays,
  diffPromptText,
  extractMessages,
  extractPromptText,
  type MessageDiffEntry,
  type TextDiffBlock,
} from "../lib/contextDiff";

type ContextDiff =
  | { mode: "messages"; entries: MessageDiffEntry[] }
  | { mode: "text"; blocks: TextDiffBlock[] };

const AUTO_LOAD_MAX_BYTES = 256 * 1024;

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${ms.toFixed(1)} ms`;
}

interface Message {
  role?: string;
  content?: unknown;
  parts?: unknown[];
  [key: string]: unknown;
}

function asMessages(value: unknown): Message[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const looksLikeMessages = value.every(
    (m) => typeof m === "object" && m !== null && ("role" in m || "parts" in m || "content" in m),
  );
  return looksLikeMessages ? (value as Message[]) : null;
}

function MessageView({ message }: { message: Message }) {
  const role = typeof message.role === "string" ? message.role : "message";
  const rest: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(message)) {
    if (k !== "role" && k !== "content" && k !== "parts") rest[k] = v;
  }
  return (
    <div className={`msg ${role}`}>
      <div className="role mono">{role}</div>
      {message.parts !== undefined ? (
        (message.parts as unknown[]).map((part, i) => {
          const p = part as Record<string, unknown>;
          return (
            <div key={i} className="mono payload-part">
              {typeof p["content"] === "string" ? (
                <span>{p["content"] as string}</span>
              ) : (
                <span>{JSON.stringify(part, null, 1)}</span>
              )}
            </div>
          );
        })
      ) : message.content !== undefined ? (
        <div className="mono">
          {typeof message.content === "string"
            ? message.content
            : JSON.stringify(message.content, null, 1)}
        </div>
      ) : null}
      {Object.keys(rest).length > 0 && <div className="mono">{JSON.stringify(rest, null, 1)}</div>}
    </div>
  );
}

function PayloadSide({ label, value }: { label: string; value: unknown }) {
  const messages = asMessages(value);
  return (
    <>
      <h3>{label}</h3>
      {messages !== null ? (
        messages.map((m, i) => <MessageView key={i} message={m} />)
      ) : (
        <pre className="payload mono">{JSON.stringify(value, null, 2)}</pre>
      )}
    </>
  );
}

function honestyChips(event: TimelineEvent): { text: string; warn: boolean }[] {
  const chips: { text: string; warn: boolean }[] = [];
  const a = event.attrs;
  if (event.provenance.captureMode === "proxy") {
    chips.push({ text: "via proxy — partial capture", warn: true });
  }
  if (a["sessionist.late_arrival"] === true) chips.push({ text: "late arrival", warn: false });
  if (typeof a["sessionist.derived"] === "string") {
    chips.push({ text: `derived: ${a["sessionist.derived"] as string}`, warn: false });
  }
  if (a["sessionist.payload_parse_error"] === true) {
    chips.push({ text: "payload kept verbatim — parse failed", warn: true });
  }
  for (const key of Object.keys(a)) {
    if (key.startsWith("otel.dropped_") && typeof a[key] === "number" && (a[key] as number) > 0) {
      chips.push({ text: `${key.replace("otel.", "").replaceAll("_", " ")}: ${a[key] as number}`, warn: true });
    }
  }
  return chips;
}

export function Inspector({
  event,
  prevLlmCall,
}: {
  event: TimelineEvent | undefined;
  prevLlmCall?: TimelineEvent | undefined;
}) {
  const [payload, setPayload] = useState<EventPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [wanted, setWanted] = useState(false);
  const [diff, setDiff] = useState<ContextDiff | null>(null);

  // Context diff vs the previous llm_call, mode chosen by payload shape: message diff for chat
  // arrays, line diff for string prompts. Matching is on exact bytes, so an edit shows as removed + added.
  useEffect(() => {
    setDiff(null);
    if (
      event === undefined ||
      prevLlmCall === undefined ||
      event.type !== "llm_call" ||
      !event.hasPayload ||
      !prevLlmCall.hasPayload
    ) {
      return;
    }
    let cancelled = false;
    Promise.all([
      getPayload(event.sessionId, event.seq),
      getPayload(prevLlmCall.sessionId, prevLlmCall.seq),
    ])
      .then(([currPayload, prevPayload]) => {
        if (cancelled) return;
        const currMessages = extractMessages(currPayload.input);
        const prevMessages = extractMessages(prevPayload.input);
        if (currMessages !== null && prevMessages !== null) {
          setDiff({ mode: "messages", entries: diffMessageArrays(prevMessages, currMessages) });
          return;
        }
        const currText = extractPromptText(currPayload.input);
        const prevText = extractPromptText(prevPayload.input);
        if (currText !== null && prevText !== null) {
          setDiff({ mode: "text", blocks: diffPromptText(prevText, currText) });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [event?.sessionId, event?.seq, prevLlmCall?.seq]);

  const autoLoad =
    event !== undefined && event.hasPayload && (event.payloadBytes ?? 0) <= AUTO_LOAD_MAX_BYTES;

  useEffect(() => {
    setPayload(null);
    setWanted(false);
  }, [event?.sessionId, event?.seq]);

  useEffect(() => {
    if (event === undefined || !event.hasPayload || (!autoLoad && !wanted)) return;
    let cancelled = false;
    setLoading(true);
    getPayload(event.sessionId, event.seq)
      .then((p) => {
        if (!cancelled) setPayload(p);
      })
      .catch(() => {
        if (!cancelled) setPayload(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [event?.sessionId, event?.seq, autoLoad, wanted]);

  if (event === undefined) {
    return (
      <section className="inspector">
        <p className="none">Select a step — click the tape, or use ← → and E.</p>
      </section>
    );
  }

  const chips = honestyChips(event);
  const tokens = Object.entries(event.attrs).filter(([k]) => k.startsWith("gen_ai.usage."));

  return (
    <section className="inspector">
      <h3>
        #{event.seq} · {event.type}
      </h3>
      <div className="kv mono">
        <span className="k">name</span>
        <span className="v">{event.name}</span>
        <span className="k">ts</span>
        <span className="v">{event.ts}</span>
        {event.durationMs !== undefined && (
          <>
            <span className="k">duration</span>
            <span className="v">{fmtMs(event.durationMs)}</span>
          </>
        )}
        <span className="k">status</span>
        <span className="v">{event.status}</span>
        {tokens.map(([k, v]) => (
          <span key={k} style={{ display: "contents" }}>
            <span className="k">{k.replace("gen_ai.usage.", "")}</span>
            <span className="v">{String(v)}</span>
          </span>
        ))}
      </div>

      {chips.length > 0 && (
        <p>
          {chips.map((chip, i) => (
            <span key={i} className={`badge ${chip.warn ? "warn" : ""}`} style={{ marginRight: 6 }}>
              {chip.text}
            </span>
          ))}
        </p>
      )}

      {event.hasPayload ? (
        loading ? (
          <p className="loading mono">loading payload…</p>
        ) : payload !== null ? (
          <>
            {payload.input !== undefined && <PayloadSide label="input" value={payload.input} />}
            {payload.output !== undefined && <PayloadSide label="output" value={payload.output} />}
          </>
        ) : !autoLoad ? (
          <p>
            <button className="load-btn" onClick={() => setWanted(true)}>
              load payload ({event.payloadBytes !== undefined ? fmtBytes(event.payloadBytes) : "large"})
            </button>
          </p>
        ) : (
          <p className="none">payload unavailable</p>
        )
      ) : (
        <p className="none">No payload was captured for this step. Absent in the telemetry — not hidden.</p>
      )}

      {diff !== null && prevLlmCall !== undefined && (
        <>
          <h3>context Δ vs #{prevLlmCall.seq}</h3>
          {(diff.mode === "messages" ? diff.entries : diff.blocks).every((d) => d.status === "same") ? (
            <p className="none">
              Identical context — the model received the same {diff.mode === "messages" ? "messages" : "prompt"}.
            </p>
          ) : diff.mode === "messages" ? (
            diff.entries.map((entry, i) => (
              <div key={i} className={`diff-entry ${entry.status}`}>
                <span className="diff-tag mono">
                  {entry.status === "added" ? "+ added" : entry.status === "removed" ? "− dropped" : "  same"}
                </span>
                <MessageView message={entry.message as Message} />
              </div>
            ))
          ) : (
            diff.blocks.map((block, i) => (
              <div key={i} className={`diff-entry ${block.status}`}>
                <span className="diff-tag mono">
                  {block.status === "added" ? "+ added" : block.status === "removed" ? "− dropped" : "  same"}
                </span>
                <pre className="payload mono diff-text">{block.text}</pre>
              </div>
            ))
          )}
        </>
      )}

      <h3>attributes</h3>
      <div className="kv mono">
        {Object.entries(event.attrs).map(([k, v]) => (
          <span key={k} style={{ display: "contents" }}>
            <span className="k">{k}</span>
            <span className="v">{typeof v === "string" ? v : JSON.stringify(v)}</span>
          </span>
        ))}
      </div>

      <h3>provenance</h3>
      <div className="kv mono">
        <span className="k">trace</span>
        <span className="v">{event.provenance.traceId || "—"}</span>
        <span className="k">span</span>
        <span className="v">{event.provenance.spanId || "—"}</span>
        <span className="k">dialect</span>
        <span className="v">{event.provenance.dialect}</span>
        <span className="k">capture</span>
        <span className="v">{event.provenance.captureMode}</span>
      </div>
    </section>
  );
}
