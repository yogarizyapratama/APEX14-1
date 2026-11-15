# APEX14 — The Intelligent API Framework

> **Less Code. More Intent.**  
> Direct Function API · TypeScript · Multi-Runtime · Enterprise-Ready

---

## What is APEX14?

**APEX14** is a next-generation TypeScript API framework built from the ground up around a **Zero-Instance Direct Function API**.

In APEX14, you never instantiate an application object. You import functions directly and return ordinary values:

```ts
import { route, run } from "apex14";

route("/", () => "Hello World");

route("/health", () => ({
  status: "healthy",
  framework: "APEX14"
}));

route("/users", {
  GET: () => User.all(),
  POST: ({ body }) => User.create(body)
});

run(3000);
```

**No `const app = new Apex()`. No `app.get()`. No `app.json()`. No unnecessary response boilerplate.**

---

## Core Pillars

- **Direct Function API:** Zero-instance developer experience with automatic serialization of strings, objects, arrays, streams, and web responses.
- **Context Isolation:** Built upon scoped `AsyncLocalStorage` and immutable routing manifests. Parallel test suites and concurrent serverless invocations run in absolute isolation without cross-contamination.
- **End-to-End Type Safety:** First-class schema validation and static type inference powered by TypeBox (`Type`).
- **Enterprise Security Engine:** Built-in WebCrypto JWT with claim and algorithm allowlists, Argon2/scrypt timing-safe password hashing, sliding-window rate limiting, and automated SSRF private IP blocking.
- **Streaming & Safe Storage:** Direct `file.save()` and `file.download()` with magic-byte file signature validation and path traversal defense.
- **Unified Database & CRUD:** Embedded SQLite support out-of-the-box, parameterized query execution, transactions, and automated `resource()` CRUD endpoint generation.
- **Multi-Runtime Architecture:** Native adapters for Node.js (`node:http`) and Bun (`Bun.serve`) without leaking runtime assumptions into the portable core.
- **Developer Tooling:** Full-featured CLI (`apex14 create`, `apex14 doctor`, `apex14 routes`, `apex14 generate`).

---

## Installation

Create a new project in seconds:

```bash
# Using npm
npx create-apex14 my-api

# Using pnpm
pnpm create apex14 my-api

# Or via the APEX14 CLI
npx apex14 create my-api --template professional
```

Or add to an existing project:

```bash
pnpm add apex14
```

---

## Developer Experience Highlights

### 1. Direct Return Values

APEX14 automatically serializes return values according to standard HTTP semantics:

```ts
import { route } from "apex14";

// Text response (text/plain)
route("/hello", () => "Hello World");

// JSON response (application/json)
route("/status", () => ({ status: "ok", code: 200 }));

// Array response (application/json)
route("/scores", () => [98, 85, 92]);

// Redirect
route("/old-home", ({ redirect }) => redirect("/new-home", 301));
```

### 2. Method Maps & Route Groups

```ts
import { route, group, use } from "apex14";

group("/api/v1", () => {
  route("/users", {
    GET: () => User.all(),
    POST: ({ body }) => User.create(body)
  });

  route("/users/:id", {
    GET: ({ params }) => User.find(params.id),
    DELETE: ({ params }) => User.delete(params.id)
  });
});
```

### 3. Type-Safe Schema Validation

```ts
import { route, Type } from "apex14";

const UserSchema = Type.Object({
  name: Type.String({ minLength: 2 }),
  email: Type.String({ format: "email" }),
  role: Type.Optional(Type.Union([Type.Literal("admin"), Type.Literal("member")]))
});

route("/users", {
  POST: ({ body }) => {
    // 'body' is automatically validated and typed!
    return { created: true, user: body };
  }
}, { body: UserSchema });
```

### 4. Zero-Query Model & ORM Engine (`model()`)

APEX14 comes with an ultra-easy, zero-query ORM engine. **No raw SQL queries, no manual `CREATE TABLE` required**:

```ts
import { route, model, Type } from "apex14";

// 1. Define model with TypeBox schema (tables auto-generate automatically!)
const User = model("users", Type.Object({
  name: Type.String(),
  email: Type.String({ format: "email" }),
  role: Type.String({ default: "member" })
}), {
  timestamps: true, // auto created_at & updated_at
  softDelete: true  // auto deleted_at handling
});

// 2. Create record (auto returns inserted record with generated id and timestamps)
const user = await User.create({
  name: "Alex",
  email: "alex@example.com",
  role: "admin"
});

// 3. Query records
const allUsers = await User.all();
const user42 = await User.find(42);
const admin = await User.findOne({ email: "admin@apex14.dev" });

// 4. Fluent chain syntax
const active = await User
  .where("role", "member")
  .where("age", ">=", 18)
  .orderBy("created_at", "DESC")
  .limit(10)
  .get();

// 5. Update & Delete (Zero SQL!)
await User.update(42, { name: "Alex Updated" });
await User.delete(42); // Soft deletes if softDelete is enabled!
```

### 5. Zero-Boilerplate CRUD Resources

Generate standard RESTful CRUD endpoints (`list`, `read`, `create`, `update`, `delete`) tied to your database table:

```ts
import { resource, Type } from "apex14";

resource("products", {
  database: "main",
  schema: Type.Object({
    title: Type.String({ minLength: 3 }),
    price: Type.Number({ minimum: 0 })
  }),
  allowedFields: ["title", "price"],
  pagination: { default: 20, max: 100 }
});
// Generates:
// GET /products (paginated with ?page=1&limit=20)
// GET /products/:id
// POST /products
// PUT /products/:id
// DELETE /products/:id
```

### 5. Secure File Uploads

```ts
import { route, file } from "apex14";

route("/upload/avatar", {
  POST: async ({ files }) => {
    // Magic-byte signature verification prevents disguised executables
    const saved = await file.save(files.avatar, {
      enforceSignature: true,
      allowedMimes: ["image/*"],
      maxSizeBytes: 5 * 1024 * 1024 // 5MB limit
    });
    return { success: true, file: saved };
  }
});
```

### 6. Built-in Security Engine

```ts
import { secure, guard, use, rateLimit, securityHeaders, cors, Jwt } from "apex14";

secure({
  jwt: { secret: process.env.JWT_SECRET!, expiresIn: "1h" },
  cors: { origin: ["https://myapp.com"], credentials: true }
});

use(securityHeaders());
use(cors({ origin: ["https://myapp.com"], credentials: true }));
use(rateLimit({ max: 100, windowMs: 60000 }));

guard("admin", (ctx) => {
  return ctx.user?.role === "admin";
});

route("/admin/dashboard", () => ({ secretMetrics: true }), {
  guard: "admin"
});
```

### 7. Real-Time Primitives: SSE & WebSockets

```ts
import { sse, ws } from "apex14";

// Server-Sent Events with async generators
sse("/ai/stream", async function* () {
  yield { event: "token", data: "Hello" };
  yield { event: "token", data: "World" };
});

// WebSockets with room broadcasting
ws("/chat/:roomId", {
  open: (peer) => peer.join(peer.params.roomId),
  message: (peer, data) => peer.publish(peer.params.roomId, data),
  close: (peer) => peer.leave(peer.params.roomId)
});
```

### 8. Background Tasks & Job Scheduler

```ts
import { task, schedule } from "apex14";

// Non-blocking background worker queue
export const sendEmail = task("sendEmail", async ({ to, subject }) => {
  await mailer.send({ to, subject });
});

// Zero-dependency recurring jobs
schedule("1h", async () => {
  await User.delete({ status: "expired" });
});
```

### 9. Native AI & MCP (Model Context Protocol) Bridge

Turn your REST API routes into native AI Agent tools (Claude, Cursor, OpenAI, Gemini) in 1 line:

```ts
import { route, exportMcpTools, Type } from "apex14";

route("/weather", {
  POST: ({ body }) => ({ city: body.city, temp: 28 })
}, {
  summary: "Get current weather for a city",
  body: Type.Object({ city: Type.String() }),
  aiTool: true
});

// Mount standard JSON-RPC 2.0 MCP server endpoint
route("/mcp", exportMcpTools());
```

### 10. Live OpenAPI 3.1 & Interactive Docs Playground

```ts
import { run } from "apex14";

// Automatically serves modern Scalar interactive documentation on /_docs
run({ port: 3000, docs: true });
```

### 11. End-to-End Type-Safe Frontend Client

```ts
import { createApexClient } from "@apex14/client";

const api = createApexClient("https://api.myapp.com");

// Full autocomplete & typed response
const users = await api.users.get({ query: { limit: 10 } });
const user = await api.users(42).get();
await api.users.post({ body: { name: "Alice" } });
```

### 12. Embedded Developer Studio (`/_studio`)

```ts
import { run } from "apex14";

// Serves visual Data Explorer, Route Registry, and Task Inspector
run({ port: 3000, studio: true });
```

### 13. Native Resilience: Circuit Breaker & Retries

```ts
import { resilient } from "apex14";

export const callStripe = resilient(async (data) => fetch("https://api.stripe.com/..."), {
  retries: 3,
  backoff: "exponential",
  circuitBreaker: { failureThreshold: 0.5, resetTimeoutMs: 30000 }
});
```

### 14. Multi-Tier Caching & SWR

```ts
import { route, cache } from "apex14";

route("/trending", () => getTrending(), {
  cache: { ttl: "60s", tags: ["trending"], swr: true }
});

cache.invalidate("trending");
```

### 15. Native Webhook Engine & Idempotency

```ts
import { webhook } from "apex14";

webhook("/webhooks/stripe", {
  provider: "stripe",
  secret: process.env.STRIPE_WEBHOOK_SECRET!,
  idempotent: true, // Auto-skips duplicate event IDs
  handler: async (event) => {
    // Cryptographically verified via WebCrypto HMAC
  }
});
```

### 16. Universal Edge & Serverless Export

```ts
import { route, toFetch } from "apex14";

route("/", () => "Hello Cloudflare Workers!");

// Universal Web Standard fetch export:
export default { fetch: toFetch() };
```

---

## The Next-Horizon Innovations (2026 Breakthroughs)

### 1. Direct Auth & Sessions (`auth`)
```ts
import { auth, route, guard } from "apex14";

auth.configure({
  secret: process.env.JWT_SECRET,
  session: { strategy: "jwt", cookieName: "apex14_session" }
});

// Auto-mounts /auth/register, /auth/login, /auth/me, /auth/logout
route("/dashboard", { GET: ({ user }) => ({ user: user.email }) }, { guard: "auth" });
```

### 2. Durable Step Functions & Saga Workflows (`workflow`)
```ts
import { workflow, route } from "apex14";

const orderFulfillment = workflow("orders", async (ctx, payload: { orderId: string }) => {
  const stock = await ctx.step("reserve-inventory", () => Inventory.reserve(payload.orderId), {
    rollback: () => Inventory.release(payload.orderId) // Automatic saga compensation on failure!
  });
  await ctx.sleep("24h"); // Resumes safely across server restarts!
  await ctx.step("send-receipt", () => Mailer.send(payload.orderId));
});

route("/checkout", { POST: ({ body }) => orderFulfillment.trigger(body) });
```

### 3. Reactive Live Queries (`live`)
```ts
import { live, model } from "apex14";

const Messages = model("messages", MessageSchema);

// Pushes initial snapshot over SSE and automatically streams live updates on model mutations!
live("/rooms/:id/messages", ({ params }) => {
  return Messages.findMany({ where: { roomId: params.id } });
}, { model: "messages" });
```

### 4. Incident Replay & Self-Healing Telemetry (`heal`)
```ts
import { heal } from "apex14";

heal.configure({ enabled: true, replayCapture: true });

// Unhandled 500 exceptions are captured with sanitized state snapshots and AI remediation prompts.
// Replay any production incident with 1 click in the APEX14 Studio GUI!
```

### 5. Type-Safe Dual-Mode Contract SDK (`contract`)
```ts
import { contract, route, Type } from "apex14";

const CreateUser = contract({
  body: Type.Object({ email: Type.String({ format: "email" }), name: Type.String() }),
  response: Type.Object({ id: Type.String() }),
  summary: "Create User"
});

// Powers runtime validation, OpenAPI 3.1, MCP AI tools, and @apex14/client in 1 line
route("/users", CreateUser, ({ body }) => ({ id: "usr_1" }));
```

### 6. Micro-Benchmarking & Performance Verification
```bash
npx apex14 benchmark /users --duration 2000 --requests 1000
```

### 7. Autonomous AI Agent Runtime (`agent`)
```ts
import { agent, route, task } from "apex14";

const supportAgent = agent("customer-support", {
  system: "You are an AI support specialist.",
  tools: [refundTask, "orders.findMany"],
  memory: { strategy: "session" }
});

route("/api/chat", supportAgent.handleStream());
```

### 8. Kernel-Level Row-Level Multi-Tenancy (`tenant`)
```ts
import { tenant, model, route } from "apex14";

tenant.configure({ header: "x-tenant-id", column: "tenant_id" });

// Queries are transparently scoped to the active tenant without manual where clauses!
route("/invoices", () => Invoices.all());
```

### 9. Temporal Time-Travel Data Auditing (`audit`)
```ts
import { model, audit } from "apex14";

const Users = model("users", UserSchema, { audit: true });

// Inspect historical state at any point in time
const pastUser = Users.asOf("2026-01-01T00:00:00Z").findById(42);
const changeHistory = audit.getHistory("users", 42);
```

### 10. Event Sourcing & Transactional Outbox (`event`)
```ts
import { event, route } from "apex14";

const UserSignedUp = event<{ email: string }>("user.signed_up");

route("/signup", async ({ body }) => {
  const user = await User.create(body);
  await UserSignedUp.publish({ email: user.email }, { transactional: true });
  return user;
});
```

### 11. Native Chaos Engineering Simulator (`chaos`)
```ts
import { chaos } from "apex14";

chaos.inject({
  routes: ["/payment/*"],
  latencyMs: { min: 200, max: 800 },
  failureRate: 0.10, // 10% simulated HTTP 503
  enableWhen: () => process.env.NODE_ENV === "staging"
});
```

### 12. Multi-Region Geo-Routing & Replica Steering (`geo`)
```ts
import { route, geo } from "apex14";

route("/feed", {
  GET: geo.steer({
    regions: {
      asia: () => TokyoReplica.getFeed(),
      europe: () => FrankfurtReplica.getFeed(),
      americas: () => VirginiaPrimary.getFeed()
    },
    fallback: () => VirginiaPrimary.getFeed()
  })
});
```

---

## Performance Benchmarks

Honest and reproducible micro-benchmarks on macOS Darwin ARM64 running Node v24.5.0:

```bash
pnpm bench
```

| Route Pattern | Throughput (ops/sec) | Avg Latency |
|---|---|---|
| Root Static (`/`) | **23,218,006** ops/sec | **43 ns/op** |
| Single Param (`/users/:id`) | **3,864,066** ops/sec | **259 ns/op** |
| Deep Static (`/api/v1/health/detailed`) | **2,799,932** ops/sec | **357 ns/op** |
| Multi-Param (`/org/:o/prj/:p/iss/:i`) | **1,606,611** ops/sec | **622 ns/op** |
| Wildcard Route (`/static/*filepath`) | **1,359,946** ops/sec | **735 ns/op** |

---

## Monorepo Architecture

```text
apex14/
├── packages/
│   ├── apex14/            # Umbrella export (Direct Function API)
│   ├── core/               # Kernel, Scope & AsyncLocalStorage context
│   ├── router/             # Radix-tree Trie Router
│   ├── http/               # Universal Request Context & Serializer
│   ├── validation/         # TypeBox-based validation engine
│   ├── security/           # JWT, Scrypt, Rate Limit, CORS, SSRF
│   ├── storage/            # File management, signatures & storage
│   ├── database/           # SQLite driver & CRUD resource generator
│   ├── client/             # End-to-end type-safe RPC client
│   ├── runtime-node/       # Node.js http/https adapter
│   ├── runtime-bun/        # Bun native serve adapter
│   ├── cli/                # apex14 developer CLI
│   └── create-apex14/      # Project scaffolder
├── examples/
│   ├── minimal/            # Pure Zero-Instance Direct API starter
│   └── rest-api/           # Complete REST API with JWT & CRUD
└── benchmarks/
    └── router.bench.js     # Reproducible router performance suite
```

---

## CLI Reference

```bash
# Diagnostic environment check
apex14 doctor

# List registered routes in active project
apex14 routes

# Generate components
apex14 generate route users
apex14 generate middleware logger
apex14 generate schema product

# Run dev server with hot reload
apex14 dev
```

---

## License

MIT © APEX14 Framework Authors.
