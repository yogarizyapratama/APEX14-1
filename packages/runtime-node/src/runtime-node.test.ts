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

  it("handles streaming SSE and error boundaries properly", async () => {
    const scope = createScope();
    scope.sse("/events", async function* () {
      yield { event: "hello", data: { text: "world" } };
    });
    scope.route("/error", () => {
      throw new Error("Deliberate failure");
    });

    const handle = await listenNode(scope, { port: 0, silent: true });

    // Test SSE streaming
    const sseRes = await fetch(`${handle.url}/events`);
    expect(sseRes.status).toBe(200);
    expect(sseRes.headers.get("content-type")).toContain("text/event-stream");
    const reader = sseRes.body?.getReader();
    const chunk = await reader?.read();
    const text = new TextDecoder().decode(chunk?.value);
    expect(text).toContain("event: hello");
    expect(text).toContain('"text":"world"');
    reader?.releaseLock();

    // Test Error boundary
    const errRes = await fetch(`${handle.url}/error`);
    expect(errRes.status).toBe(500);
    const errJson = await errRes.json();
    expect(errJson.error.message).toBe("Deliberate failure");

    await handle.close();
  });

  it("handles WebSocket connections, rooms, and messaging", async () => {
    const scope = createScope();

    scope.ws("/ws/chat", {
      open: (ws) => {
        ws.send(JSON.stringify({ type: "connected", id: ws.id }));
      },
      message: (ws, data) => {
        if (data.action === "echo") {
          ws.send(JSON.stringify({ type: "echo", payload: data.payload }));
        }
      }
    });

    const handle = await listenNode(scope, { port: 0, silent: true });
    const wsUrl = `ws://localhost:${handle.port}/ws/chat`;

    // Connect using WebSocket client
    const { WebSocket: WsClient } = await import("ws");
    const ws = new WsClient(wsUrl);

    const receivedMessages: any[] = [];

    await new Promise<void>((resolve, reject) => {
      ws.on("open", () => {
        ws.send(JSON.stringify({ action: "echo", payload: "Hello WS" }));
      });

      ws.on("message", (raw) => {
        const msg = JSON.parse(raw.toString());
        receivedMessages.push(msg);
        if (msg.type === "echo") {
          ws.close();
          resolve();
        }
      });

      ws.on("error", reject);
    });

    expect(receivedMessages.length).toBe(2);
    expect(receivedMessages[0].type).toBe("connected");
    expect(receivedMessages[1].payload).toBe("Hello WS");

    await handle.close();
  });
});
