# Reactive Live Queries & Real-Time Sync (`live`)

APEX14 bridges the gap between traditional REST APIs and real-time backend-as-a-service platforms like Convex and Firebase. Instead of manually writing WebSocket broadcast handlers on every database mutation, `live()` creates query-level reactive streams.

---

## 1. Quick Example

```ts
import { live, model, Type } from "apex14";

const Messages = model("messages", Type.Object({
  roomId: Type.String(),
  text: Type.String(),
  sender: Type.String()
}));

// Browser or mobile apps connect via SSE (Server-Sent Events)
// and receive an initial snapshot followed by automatic real-time updates!
live("/rooms/:roomId/messages", async ({ params }) => {
  return await Messages.findMany({
    where: { roomId: params.roomId },
    orderBy: { created_at: "desc" },
    limit: 50
  });
}, {
  model: "messages" // Automatically invalidates & broadcasts whenever Messages mutations occur!
});
```

---

## 2. Automatic Mutation Detection

Whenever `Messages.create()`, `update()`, or `delete()` is called anywhere in your application:
1. APEX14's model mutation hook catches the event.
2. The active live query evaluates if the query result has changed.
3. If new data exists, an update message is immediately pushed to connected clients over SSE:
```json
{
  "type": "update",
  "data": [...],
  "timestamp": 1731678900000
}
```

---

## 3. Manual Notification Bus

You can also trigger invalidation manually for arbitrary tags:

```ts
import { live } from "apex14";

live.notify("messages");
live.notify("room:101");
```

---

## 4. Frontend Client Consumption

```ts
const eventSource = new EventSource("/rooms/lobby/messages");

eventSource.onmessage = (event) => {
  const packet = JSON.parse(event.data);
  if (packet.type === "snapshot") {
    console.log("Initial state:", packet.data);
  } else if (packet.type === "update") {
    console.log("Real-time update:", packet.data);
  }
};
```
