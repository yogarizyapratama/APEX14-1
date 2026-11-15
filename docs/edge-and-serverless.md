# APEX14 — Universal Edge & Serverless Deployment

APEX14 is built natively on **Web Platform Standards** (`Request`, `Response`, `Headers`, `ReadableStream`). The exact same API code runs on Node.js, Bun, Cloudflare Workers, Vercel Edge, AWS Lambda, and Deno Deploy with **zero modifications**.

---

## 1. Cloudflare Workers & Vercel Edge via `toFetch()`

```ts
import { route, toFetch } from "apex14";

route("/", () => "Hello from Cloudflare Workers or Vercel Edge!");

route("/users", () => [
  { id: 1, name: "Alice" },
  { id: 2, name: "Bob" }
]);

// Export native Web Standard fetch handler:
export default {
  fetch: toFetch()
};
```

---

## 2. Deno Deploy

```ts
import { route, toFetch } from "npm:apex14";

route("/hello", () => ({ runtime: "Deno", framework: "APEX14" }));

Deno.serve(toFetch());
```

---

## 3. Node.js & Bun Hybrid

In local development or traditional VPS / Docker containers, simply invoke `run()`:

```ts
import { route, run } from "apex14";

route("/health", () => ({ status: "ok" }));

run(3000);
```
- In Node.js: automatically boots high-performance Node.js HTTP server.
- In Bun: automatically detects Bun runtime and boots native `Bun.serve()`.
