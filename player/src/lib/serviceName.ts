// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// How a session's service name is shown. The stored value is always the resource's
// service.name as sent; only the face changes. When a process never names its service,
// the OpenTelemetry SDKs fill the attribute with "unknown_service", optionally followed
// by ":" and the executable (in Node, process.argv0, which is the full binary path when
// the process was spawned by another program). That is a configuration gap, not a name,
// so it is shown as such with the value as sent behind a tooltip.

export interface ServiceFace {
  /** What to print. */
  text: string;
  /** The value as sent plus how to fix it; set only when the face is not the value. */
  tooltip?: string;
  /** True when the telemetry carried no real name. */
  unnamed: boolean;
}

const SDK_DEFAULT = /^unknown_service(?::|$)/;

export function serviceFace(service: string | undefined): ServiceFace {
  if (service === undefined || service === "") {
    return { text: "unnamed service", unnamed: true, tooltip: "The telemetry carried no service.name." };
  }
  if (SDK_DEFAULT.test(service)) {
    return {
      text: "unnamed service",
      unnamed: true,
      tooltip:
        `service.name as sent: ${service}\n` +
        "The OpenTelemetry SDK fills this in when the process sets no service name; the part " +
        "after the colon is the executable that was launched. Set OTEL_SERVICE_NAME in the " +
        "agent's environment, or service.name on its resource, to name it.",
    };
  }
  return { text: service, unnamed: false };
}
