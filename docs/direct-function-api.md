# APEX14 — Direct Function API & Core Architecture

The core innovation of APEX14 is the **Direct Function API**. Instead of requiring developers to instantiate and pass around an application instance (`const app = new Apex()`), developers import and execute functions directly.

---

## 1. Zero-Instance Developer Experience

### What you avoid:
```ts
// ❌ Traditional Frameworks (Express, Nest, Fastify, Hono, Elysia)
const app = new Application();
app.get("/", handler);
app.post("/users", handler);
app.listen(3000);
```

### The APEX14 Way:
```ts
// ✅ APEX14
import { route, run } from "apex14";

route("/", () => "Hello World");
route("/users", {
  GET: () => User.all(),
  POST: ({ body }) => User.create(body)
});

run(3000);
```

---

## 2. Core Direct Functions

| Function | Responsibility |
|---|---|
| `route(path, handlerOrMethodMap, options?)` | Register routes (static, param, wildcard) |
| `group(prefix, callback, options?)` | Group routes with shared prefixes, guards, and middleware |
| `use(middleware)` | Register global interceptor middleware |
| `guard(name, guardFn)` | Define access control guards |
| `secure(config)` | Configure JWT, CORS, rate limits, and security headers |
| `run(portOrOptions)` | Start the universal HTTP server (Node.js or Bun) |
| `inject(name, service)` | Register dependencies in service container |
| `getService(name)` | Resolve registered dependencies |
| `createScope()` | Create an isolated application context |
| `withScope(scope, fn)` | Run code within a designated scope |
| `testRequest(url, init?)` | Execute in-memory HTTP requests for tests |

---

## 3. Direct Return Values & Auto-Serialization

Handlers in APEX14 return ordinary values. The framework serializes responses automatically according to standard HTTP content negotiation:

```ts
import { route } from "apex14";

// 1. String -> text/plain (or text/html if HTML tags detected)
route("/name", () => "APEX14");

// 2. Object or Array -> application/json; charset=utf-8
route("/user", () => ({ id: 1, name: "Alex" }));
route("/tags", () => ["typescript", "api", "framework"]);

// 3. Number or Boolean -> application/json; charset=utf-8
route("/count", () => 42);
route("/active", () => true);

// 4. Undefined -> 204 No Content
route("/action", () => undefined);

// 5. Null -> 200 with "null" JSON body
route("/empty", () => null);

// 6. Native Web Response -> pass-through with context headers merged
route("/custom", () => new Response("custom", { status: 201 }));

// 7. Redirect -> 302/301 Response with Location header
route("/go", ({ redirect }) => redirect("/destination", 301));

// 8. Stream -> application/octet-stream
route("/stream", () => new ReadableStream({ ... }));
```

---

## 4. Route Groups & Nested Prefixes

Groups allow modular structuring of APIs:

```ts
import { group, route } from "apex14";

group("/api", () => {
  // Nested group: /api/v1
  group("/v1", () => {
    route("/users", () => ({ version: "v1", users: [] }));
    route("/products", () => ({ version: "v1", products: [] }));
  });

  // Nested group: /api/v2
  group("/v2", () => {
    route("/users", () => ({ version: "v2", users: [] }));
  });
});
```

Groups inherit:
- Prefixes (e.g. `/api` + `/v1` + `/users` -> `/api/v1/users`)
- Group middleware
- Group guards

---

## 5. Context Isolation Architecture

How does APEX14 avoid unsafe mutable global state when using direct functions?

### `AsyncLocalStorage` & Scope Hierarchy
- APEX14 uses `AsyncLocalStorage<ApexScope>` internally.
- By default, direct function calls register onto the default global scope for zero-instance developer ergonomics.
- When running parallel unit tests or multi-tenant serverless requests, developers can use `createScope()` and `withScope()`:

```ts
import { createScope, withScope, route } from "apex14";

// Test Environment A
const scopeA = createScope();
withScope(scopeA, () => {
  route("/test", () => "Scope A");
});

// Test Environment B (completely isolated)
const scopeB = createScope();
withScope(scopeB, () => {
  route("/test", () => "Scope B");
});

const resA = await scopeA.handle(new Request("http://localhost/test"));
const resB = await scopeB.handle(new Request("http://localhost/test"));

console.log(await resA.text()); // "Scope A"
console.log(await resB.text()); // "Scope B"
```
Neither registry conflicts or leaks state across test runners or async execution contexts.
