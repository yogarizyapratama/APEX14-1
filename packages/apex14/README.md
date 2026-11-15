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
    GET: () => db("main").query("SELECT * FROM users"),
    POST: ({ body }) => db("main").execute("INSERT INTO users (name) VALUES (?)", [body.name])
  });

  route("/users/:id", {
    GET: ({ params }) => db("main").query("SELECT * FROM users WHERE id = ?", [params.id]),
    DELETE: ({ params }) => db("main").execute("DELETE FROM users WHERE id = ?", [params.id])
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

### 4. Full ORM Database Engine (`db("table")`)

APEX14 includes an ultra-intuitive, fluent ORM query builder:

```ts
import { route, db } from "apex14";

// 1. Create record
const user = await db("users").create({
  name: "Alex",
  email: "alex@example.com",
  role: "admin"
});

// 2. Find many with filtering & sorting
const admins = await db("users").findMany({
  where: { role: "admin" },
  orderBy: { created_at: "desc" },
  limit: 20
});

// 3. Find single record by ID
const profile = await db("users").findById(42);

// 4. Fluent chain syntax
const active = await db("users")
  .where("role", "member")
  .where("age", ">=", 18)
  .orderBy("created_at", "DESC")
  .limit(10)
  .get();

// 5. Update & Delete
await db("users").where({ id: 42 }).update({ name: "Alex Updated" });
await db("users").deleteById(42);
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
