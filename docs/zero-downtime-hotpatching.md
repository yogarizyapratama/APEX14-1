# Dynamic Zero-Downtime Hot-Patching (`patch`)

Traditional frameworks require restarting the entire Node or Bun process to deploy a bug fix or update an endpoint. In production, restarting drops active WebSocket connections, breaks long-running streaming LLM sessions, and introduces cold boot latency.

APEX14 allows live, in-memory route hot-patching with instant rollback.

---

## 1. Hot-Patching a Route

```ts
import { patch, route } from "apex14";

// Initial route
route("/api/orders/discount", (ctx) => {
  return { rate: 0.05, code: "STANDARD" };
});

// Deploy an urgent holiday flash-sale discount live without restarting!
patch.route("/api/orders/discount", (ctx) => {
  return { rate: 0.20, code: "FLASH_SALE_LIVE" };
});
```

---

## 2. Instant Rollback

If unexpected bugs occur, roll back to the previous handler immediately:

```ts
patch.rollback("/api/orders/discount");
```

---

## 3. Audit History & Observability

Inspect which patches were applied, when, and by whom:

```ts
const history = patch.history();
console.log(history);
// [
//   { id: 'patch_177300...', path: '/api/orders/discount', timestamp: 1773001234, ... }
// ]

// Subscribe to patch events
patch.onPatch((record) => {
  telemetry.log(`Hot-patch applied to ${record.path} at ${record.timestamp}`);
});
```
