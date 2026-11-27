// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// The egress guard refuses every connection that is not to this machine, before the name is looked up,
// and leaves loopback untouched. Runs in its own worker, so the patch reaches nothing else.

import { createServer as createHttpServer, type Server } from "node:http";
import { connect, type AddressInfo } from "node:net";
import { once } from "node:events";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EGRESS_REFUSED, allowOutbound, installEgressGuard, isAllowedHost, isLoopbackHost, setOffline } from "../src/cli/egress.js";

let server: Server;
let port: number;

beforeAll(async () => {
  installEgressGuard();
  server = createHttpServer((_req, res) => res.end("ok"));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  port = (server.address() as AddressInfo).port;
});

afterAll(() => {
  server.close();
});

describe("what counts as this machine", () => {
  it("is loopback by any spelling, and the default when no host is given", () => {
    for (const h of [undefined, "", "localhost", "LOCALHOST", "127.0.0.1", "127.1.2.3", "::1", "[::1]", "::ffff:127.0.0.1"]) {
      expect(isLoopbackHost(h), String(h)).toBe(true);
    }
    for (const h of ["example.com", "10.0.0.1", "192.168.1.1", "0.0.0.0", "128.0.0.1", "registry.npmjs.org"]) {
      expect(isLoopbackHost(h), h).toBe(false);
    }
  });
});

describe("the guard", () => {
  it("leaves loopback alone: a raw socket and a fetch both reach the local server", async () => {
    const socket = connect(port, "127.0.0.1");
    await once(socket, "connect");
    socket.destroy();
    const response = await fetch(`http://127.0.0.1:${String(port)}/`);
    expect(await response.text()).toBe("ok");
  });

  it("refuses a raw connection elsewhere with its own error, as a connection failure", async () => {
    const socket = connect(80, "example.com");
    const [err] = (await once(socket, "error")) as [NodeJS.ErrnoException];
    expect(err.code).toBe(EGRESS_REFUSED);
    expect(err.message).toContain("example.com");
  });

  it("refuses a fetch elsewhere, surfacing the same cause", async () => {
    await expect(fetch("http://example.com/")).rejects.toMatchObject({
      cause: { code: EGRESS_REFUSED },
    });
  });

  it("refuses an https host too, before any lookup", async () => {
    await expect(fetch("https://registry.npmjs.org/sessionist")).rejects.toMatchObject({
      cause: { code: EGRESS_REFUSED },
    });
  });

  it("lets a command lift it for one host, only for the duration of the call", async () => {
    expect(isAllowedHost("api.example.com")).toBe(false);
    const inside = await allowOutbound("api.example.com", async () => isAllowedHost("API.example.com"));
    expect(inside).toBe(true);
    expect(isAllowedHost("api.example.com")).toBe(false);
    expect(isAllowedHost("other.example.com")).toBe(false);
  });

  it("under --offline refuses even a command that asks, without running it", async () => {
    setOffline(true);
    let ran = false;
    await expect(
      allowOutbound("api.example.com", async () => {
        ran = true;
      }),
    ).rejects.toMatchObject({ code: EGRESS_REFUSED });
    expect(ran).toBe(false);
    setOffline(false);
  });
});
