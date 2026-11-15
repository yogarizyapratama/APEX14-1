import { describe, it, expect, afterAll } from "vitest";
import { listenNode, type NodeServerHandle } from "./index.js";
import { createScope } from "@apex14/core";

describe("@apex14/runtime-node", () => {
  let serverHandle: NodeServerHandle;

  afterAll(async () => {
    if (serverHandle) {
      await serverHandle.close();
    }
  });

  it("starts Node.js HTTP server, serves requests, and shuts down gracefully", async () => {
    const scope = createScope();
    scope.route("/ping", () => ({ pong: true, time: 123 }));
    scope.route("/echo", { POST: ({ body }) => ({ received: body }) });

    // Listen on ephemeral port (0)
    serverHandle = await listenNode(scope, { port: 0, silent: true });
    expect(serverHandle.port).toBeGreaterThan(0);
    expect(serverHandle.url).toContain(String(serverHandle.port));

    // GET request
    const getRes = await fetch(`${serverHandle.url}/ping`);
    expect(getRes.status).toBe(200);
    expect(getRes.headers.get("content-type")).toContain("application/json");
    const getJson = await getRes.json();
    expect(getJson).toEqual({ pong: true, time: 123 });

    // POST request with body
    const postRes = await fetch(`${serverHandle.url}/echo`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "hello node" })
    });
    expect(postRes.status).toBe(200);
    const postJson = await postRes.json();
    expect(postJson).toEqual({ received: { message: "hello node" } });

    // Close server
    await serverHandle.close();
  });
});
