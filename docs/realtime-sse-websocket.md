# APEX14 — Real-Time Primitives: SSE & WebSockets

APEX14 provides native real-time communication primitives via the Direct Function API. No boilerplate instances or fragmented packages required.

---

## 1. Server-Sent Events (SSE) via `sse()`

Stream events, progress ticks, or LLM AI completions to web clients using standard JavaScript `async function*` generators:

```ts
import { sse, run } from "apex14";

// 1. Simple Server-Sent Events stream
sse("/events", async function* (ctx) {
  yield { event: "connected", data: { time: Date.now() } };

  for (let i = 1; i <= 5; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    yield { event: "tick", data: { count: i } };
  }

  yield { event: "done", data: "Stream finished" };
});

// 2. Direct streaming LLM AI tokens
sse("/ai/chat", async function* ({ body }) {
  const stream = await llm.stream(body.prompt);
  for await (const chunk of stream) {
    yield { event: "token", data: chunk.text };
  }
});

run(3000);
```

### Supported Yield Payload Formats
- String: `yield "Hello World"` -> `data: Hello World\n\n`
- Object: `yield { message: "ok" }` -> `data: {"message":"ok"}\n\n`
- Structured Message: `yield { event: "update", id: "101", retry: 5000, data: { temp: 24 } }` ->
  ```
  id: 101
  event: update
  retry: 5000
  data: {"temp":24}

  ```

---

## 2. Direct Function WebSockets via `ws()`

APEX14 includes an ultra-intuitive WebSocket abstraction with automatic connection tracking, path parameters, and built-in room broadcasting:

```ts
import { ws, run } from "apex14";

ws("/chat/:roomId", {
  open: (peer) => {
    // Automatically join room based on dynamic route parameter
    peer.join(peer.params.roomId);
    peer.send({ type: "welcome", id: peer.id });
  },

  message: (peer, data) => {
    // Broadcast message to everyone in the room except sender
    peer.publish(peer.params.roomId, {
      from: peer.id,
      text: data.text
    });
  },

  close: (peer, code, reason) => {
    // Automatically removed from rooms upon disconnect
    console.log(`Peer ${peer.id} left room ${peer.params.roomId}`);
  }
});

run(3000);
```

### `ApexWebSocket` Interface
| Method | Description |
|---|---|
| `peer.id` | Unique UUID for the connected client |
| `peer.params` | Extracted route parameters (e.g. `peer.params.roomId`) |
| `peer.send(data)` | Sends text, JSON object, or binary data directly to this client |
| `peer.join(room)` | Subscribes this client to a room channel |
| `peer.leave(room)` | Unsubscribes this client from a room channel |
| `peer.publish(room, data)` | Broadcasts a message to all other clients in the room |
| `peer.close(code?, reason?)` | Closes the socket connection |
