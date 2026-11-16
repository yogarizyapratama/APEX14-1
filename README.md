# APEX14 — The Intelligent API Framework

<p align="center">
  <img src="https://raw.githubusercontent.com/yogarizyapratama/APEX14-1/main/assets/banner.png" alt="APEX14 Banner" width="100%" onerror="this.style.display='none'"/>
</p>

<p align="center">
  <strong>Less Code. More Intent.</strong><br/>
  Zero-Instance Direct Function API · TypeBox Contracts · Multi-Runtime (Node.js & Bun) · Enterprise Security · Autonomous AI Primitives
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/apex14"><img src="https://img.shields.io/npm/v/apex14.svg?style=flat-square&color=blue" alt="NPM Version" /></a>
  <a href="https://www.npmjs.com/package/create-apex14"><img src="https://img.shields.io/npm/v/create-apex14.svg?style=flat-square&color=orange" alt="create-apex14" /></a>
  <a href="https://github.com/yogarizyapratama/APEX14-1/actions"><img src="https://img.shields.io/badge/tests-132%20passed-brightgreen.svg?style=flat-square" alt="Tests" /></a>
  <a href="https://github.com/yogarizyapratama/APEX14-1/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License" /></a>
</p>

---

## Daftar Isi (Table of Contents)

1. [Apa itu APEX14?](#apa-itu-apex14)
2. [Instalasi & Scaffolding Proyek](#instalasi--scaffolding-proyek)
3. [Arsitektur Proyek Standar (Ala NestJS)](#arsitektur-proyek-standar-ala-nestjs)
4. [Tutorial Langkah-demi-Langkah (Membangun Modul Produk)](#tutorial-langkah-demi-langkah-membangun-modul-produk)
5. [Panduan Lengkap Fungsi & API Reference](#panduan-lengkap-fungsi--api-reference)
   - [A. Routing & Application Lifecycle](#a-routing--application-lifecycle)
   - [B. Validation & Data Contracts (TypeBox)](#b-validation--data-contracts-typebox)
   - [C. Database & Zero-Query ORM Engine](#c-database--zero-query-orm-engine)
   - [D. Enterprise Security & Authentication (JWT, Hash, Guard)](#d-enterprise-security--authentication-jwt-hash-guard)
   - [E. Storage & Secure File Uploads](#e-storage--secure-file-uploads)
   - [F. Middleware, Context & Error Handling](#f-middleware-context--error-handling)
   - [G. Real-Time Primitives (SSE & WebSockets)](#g-real-time-primitives-sse--websockets)
   - [H. Background Tasks & Scheduler](#h-background-tasks--scheduler)
   - [I. OpenAPI Documentation & Developer Studio](#i-openapi-documentation--developer-studio)
   - [J. Testing Engine (Sub-Millisecond E2E)](#j-testing-engine-sub-millisecond-e2e)
   - [K. 30 Quantum-Leap Advanced Primitives (AI, Agent, MCP, Workflow, dll.)](#k-30-quantum-leap-advanced-primitives)
6. [CLI Tooling Reference](#cli-tooling-reference)
7. [Benchmark Performa](#benchmark-performa)
8. [Struktur Monorepo](#struktur-monorepo)
9. [Lisensi](#lisensi)

---

## Apa itu APEX14?

**APEX14** adalah framework backend TypeScript modern yang dirancang dengan paradigma **Zero-Instance Direct Function API**.

Di framework tradisional (seperti Express, Fastify, NestJS), Anda harus menginstansiasi objek aplikasi (`const app = express()`, `new NestFactory()`), mengatur decorator rumit, atau membungkus respons secara manual (`res.json()`). Di APEX14, Anda cukup mengimpor fungsi dan mengembalikan nilai biasa:

```ts
import { route, run } from "apex14";

// String langsung diserialisasi sebagai text/plain
route("/", () => "Hello World");

// Object / Array otomatis menjadi application/json
route("/health", () => ({ status: "operational", uptime: process.uptime() }));

// Method map untuk endpoint multi-metode
route("/users", {
  GET: () => User.all(),
  POST: ({ body }) => User.create(body)
});

// Jalankan di Node.js atau Bun secara universal
run(3000);
```

### Mengapa APEX14 Berbeda?
- **Zero-Instance Overhead:** Tidak ada overhead instance objek server global yang berat.
- **Konkurensi & Isolasi Konteks:** Menggunakan `AsyncLocalStorage` tingkat kernel sehingga ribuan request dan parallel test berjalan terisolasi tanpa tabrakan state.
- **Type-Safe End-to-End:** Integrasi skema TypeBox (`Type`) kelas satu untuk validasi otomatis runtime dan compile-time.
- **Multi-Runtime Sejati:** Berjalan optimal tanpa konfigurasi tambahan di **Bun** (`Bun.serve`) maupun **Node.js** (`node:http`).

---

## Instalasi & Scaffolding Proyek

Cara termudah dan paling direkomendasikan untuk memulai adalah menggunakan generator resmi:

```bash
# Menggunakan Bun (Paling Cepat)
bun create apex14 my-api

# Atau menggunakan NPX
npx create-apex14 my-api

# Atau menggunakan PNPM
pnpm create apex14 my-api
```

Perintah di atas akan membuat struktur proyek aplikasi modular lengkap siap pakai, terstruktur rapi ala NestJS, dengan konfigurasi TypeScript, database SQLite bawaan, autentikasi JWT, sistem proteksi guard, Swagger OpenAPI, serta rangkaian unit test.

Setelah proyek dibuat, jalankan:
```bash
cd my-api

# 1. Install dependensi
bun install   # atau npm install / pnpm install

# 2. Jalankan mode development (Hot-Reload)
bun dev       # atau npm run dev

# 3. Jalankan pengujian otomatis (Vitest E2E)
bun test      # atau npm test
```

Buka browser Anda di `http://localhost:3000/docs` untuk melihat dokumentasi API interaktif (Swagger UI / OpenAPI).

---

## Arsitektur Proyek Standar (Ala NestJS)

Struktur folder yang dihasilkan oleh `create-apex14` menerapkan pemisahan tanggung jawab yang bersih, modular, dan siap digunakan di level enterprise (*production-ready*):

```text
my-api/
├── .env & .env.example         # Variabel lingkungan type-safe dengan dynamic getters
├── .gitignore & README.md       # Dokumentasi & panduan repositori
├── package.json & tsconfig.json # Pengaturan skrip dev, build (tsc), dan test
├── src/
│   ├── index.ts                # Entry point server (menjalankan app dan memanggil run(PORT))
│   ├── app.ts                  # Orchestrator aplikasi: CORS, Rate Limiter, Middleware, Docs, dan Route Groups
│   ├── config/
│   │   └── env.ts              # Konfigurasi aplikasi terpusat & aman
│   ├── database/
│   │   └── connection.ts       # Inisialisasi klien database SQLite & auto-DDL migration
│   ├── common/
│   │   ├── guards/
│   │   │   ├── auth.guard.ts   # Guard verifikasi Bearer JWT
│   │   │   └── roles.guard.ts  # Guard kontrol akses berbasis peran (RBAC)
│   │   ├── middleware/
│   │   │   ├── logger.middleware.ts # Structured HTTP access & latency logger
│   │   │   └── error.middleware.ts  # RFC-7807 global exception error catcher
│   │   └── utils/
│   │       └── response.ts     # Standarisasi envelope respons JSON { success, data, meta }
│   └── modules/
│       ├── health/             # Modul kesehatan sistem (/health, /health/metrics)
│       │   ├── health.route.ts
│       │   └── health.service.ts
│       ├── auth/               # Modul autentikasi (/api/v1/auth/register, login, me)
│       │   ├── auth.schema.ts  # DTO TypeBox
│       │   ├── auth.service.ts # Business logic hashing scrypt & JWT signing
│       │   └── auth.route.ts
│       ├── users/              # Modul user CRUD (/api/v1/users)
│       │   ├── users.schema.ts
│       │   ├── users.service.ts
│       │   └── users.route.ts
│       └── uploads/            # Modul file storage & uploads (/api/v1/uploads)
│           ├── uploads.service.ts
│           └── uploads.route.ts
└── test/
    └── app.test.ts             # Pengujian E2E super cepat menggunakan testRequest + Vitest
```

---

## Tutorial Langkah-demi-Langkah (Membangun Modul Produk)

Berikut adalah panduan lengkap cara menambahkan fitur baru secara modular ke dalam proyek APEX14 Anda. Kita akan membuat modul **Products** yang memiliki schema DTO, database repository, service, dan route yang diproteksi.

### Langkah 1: Buat Schema DTO (`src/modules/products/products.schema.ts`)
Gunakan `Type` dari `apex14` untuk mendefinisikan validasi input:

```ts
import { Type, type Static } from "apex14";

export const CreateProductDto = Type.Object({
  title: Type.String({ minLength: 3, maxLength: 100 }),
  price: Type.Number({ minimum: 0 }),
  category: Type.String({ minLength: 2 }),
  stock: Type.Optional(Type.Integer({ minimum: 0, default: 0 }))
});

export const UpdateProductDto = Type.Partial(CreateProductDto);

export const ProductIdParam = Type.Object({
  id: Type.String()
});

export type CreateProductInput = Static<typeof CreateProductDto>;
export type UpdateProductInput = Static<typeof UpdateProductDto>;
```

### Langkah 2: Buat Service (`src/modules/products/products.service.ts`)
Service bertugas menangani logika bisnis dan query database menggunakan ORM `db()` bawaan APEX14:

```ts
import crypto from "node:crypto";
import { db, NotFoundError } from "apex14";
import type { CreateProductInput, UpdateProductInput } from "./products.schema.js";

export class ProductsService {
  async findAll() {
    return await db("products").get();
  }

  async findById(id: string) {
    const product = await db("products").findById(id);
    if (!product) {
      throw new NotFoundError(`Product #${id} tidak ditemukan`);
    }
    return product;
  }

  async create(data: CreateProductInput) {
    const id = crypto.randomUUID();
    const newProduct = {
      id,
      title: data.title,
      price: data.price,
      category: data.category,
      stock: data.stock ?? 0,
      created_at: new Date().toISOString()
    };

    await db("products").create(newProduct);
    return newProduct;
  }

  async update(id: string, data: UpdateProductInput) {
    await this.findById(id); // Pastikan ada
    await db("products").updateById(id, {
      ...data,
      updated_at: new Date().toISOString()
    });
    return await this.findById(id);
  }

  async remove(id: string) {
    await this.findById(id);
    await db("products").deleteById(id);
    return { id, deleted: true };
  }
}

export const productsService = new ProductsService();
```

### Langkah 3: Buat Route (`src/modules/products/products.route.ts`)
Daftarkan rute endpoint HTTP dan kaitkan schema validasi serta guard keamanan:

```ts
import { route } from "apex14";
import { productsService } from "./products.service.js";
import { CreateProductDto, UpdateProductDto, ProductIdParam } from "./products.schema.js";
import { ok, created } from "../../common/utils/response.js";

export function registerProductRoutes() {
  // Public: Siapa saja bisa melihat daftar produk
  route("/products", async () => {
    const list = await productsService.findAll();
    return ok(list);
  }, {
    summary: "Daftar semua produk",
    tags: ["Products"]
  });

  // Protected: Hanya user login yang bisa membuat produk
  route("/products", async (ctx) => {
    const product = await productsService.create(ctx.body);
    ctx.status(201);
    return created(product);
  }, {
    method: "POST",
    guard: "auth",
    body: CreateProductDto,
    summary: "Tambah produk baru",
    tags: ["Products"]
  });

  // Operasi per ID
  route("/products/:id", {
    GET: async (ctx) => {
      const product = await productsService.findById(ctx.params.id);
      return ok(product);
    },
    PUT: async (ctx) => {
      const updated = await productsService.update(ctx.params.id, ctx.body);
      return ok(updated);
    },
    DELETE: async (ctx) => {
      const result = await productsService.remove(ctx.params.id);
      return ok(result);
    }
  }, {
    guard: "auth",
    params: ProductIdParam,
    summary: "Operasi detail produk",
    tags: ["Products"]
  });
}
```

### Langkah 4: Registrasikan di `src/app.ts`
Pastikan tabel di-DDL secara otomatis pada `src/database/connection.ts` dan panggil `registerProductRoutes()` di `src/app.ts`:

```ts
// src/database/connection.ts
await client.execute(`
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    price REAL NOT NULL,
    category TEXT NOT NULL,
    stock INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);
```

```ts
// src/app.ts
import { registerProductRoutes } from "./modules/products/products.route.js";

// Di dalam group("/api/v1", () => { ... })
group("/api/v1", () => {
  registerAuthRoutes();
  registerUserRoutes();
  registerUploadRoutes();
  registerProductRoutes(); // <-- Tambahkan ini!
});
```

Selesai! Buka `http://localhost:3000/docs` dan Anda akan melihat endpoint `/api/v1/products` otomatis terdaftar lengkap dengan schema request body, parameter, dan contoh respons.

---

## Panduan Lengkap Fungsi & API Reference

Seluruh primitive APEX14 dapat diimpor langsung dari paket tunggal `"apex14"`.

```ts
import {
  route, group, use, guard, secure, inject, getService, run, toFetch, handle, testRequest, enableDocs,
  Type, validateSchema, validateOrThrow,
  db, model, resource, configureDatabase, SqliteDatabaseClient,
  Jwt, hashPassword, verifyPassword, rateLimit, securityHeaders, cors, assertSafeUrl,
  file, store, configureStorage, LocalStorageProvider,
  ApexError, ValidationError, AuthenticationError, AuthorizationError, NotFoundError, ConflictError, RateLimitError,
  sse, ws, task, schedule, webhook
} from "apex14";
```

---

### A. Routing & Application Lifecycle

#### `route(path, handlerOrMethods, options?)`
Fungsi inti untuk mendaftarkan endpoint HTTP.
- **`path`**: string path rute, mendukung parameter dinamis (`:id`) dan wildcard (`*filepath`).
- **`handlerOrMethods`**: fungsi handler `(ctx) => any` atau objek method map `{ GET: handler, POST: handler }`.
- **`options`**: metadata route seperti `body`, `query`, `params`, `guard`, `middleware`, `summary`, `tags`.

```ts
import { route, Type } from "apex14";

// 1. Single handler (default GET)
route("/ping", () => "pong");

// 2. Method Map
route("/articles/:slug", {
  GET: ({ params }) => Article.findBySlug(params.slug),
  PUT: ({ params, body }) => Article.update(params.slug, body),
  DELETE: ({ params }) => Article.delete(params.slug)
}, {
  guard: "auth",
  summary: "Article detail operations"
});
```

#### `group(prefix, callback, options?)`
Mengelompokkan rute dengan prefix URL bersama dan middleware/guard hierarkis:

```ts
import { group, route } from "apex14";

group("/api/v1", () => {
  group("/admin", () => {
    route("/metrics", () => ({ status: "ok" }));
  }, { guard: "admin" }); // Seluruh route di dalam /admin otomatis mewarisi guard admin
});
```

#### `use(middleware)`
Mendaftarkan middleware global yang dieksekusi pada setiap request masuk dalam rantai *onion architecture*:

```ts
import { use } from "apex14";

use(async (ctx, next) => {
  const start = Date.now();
  const res = await next(); // Eksekusi handler selanjutnya
  const latency = Date.now() - start;
  console.log(`[${ctx.request.method}] ${ctx.url.pathname} - ${latency}ms`);
  return res;
});
```

#### `run(portOrOptions)`
Universal launcher otomatis. Mendeteksi apakah runtime adalah Bun atau Node.js dan menjalankan server native berperforma tinggi:

```ts
import { run } from "apex14";

// Berdasarkan port sederhana
run(3000);

// Atau opsi lengkap
run({
  port: 8080,
  host: "0.0.0.0",
  silent: false
});
```

#### `toFetch()` & `handle(request)`
Mengekspor aplikasi APEX14 sebagai handler Web Fetch standar (`(req: Request) => Promise<Response>`), memungkinkan deploy ke Cloudflare Workers, Vercel Edge, Deno, atau AWS Lambda:

```ts
import { toFetch } from "apex14";

export default {
  fetch: toFetch()
};
```

#### `enableDocs(options)`
Mengaktifkan antarmuka OpenAPI 3.1 dan Swagger/Scalar UI interaktif:

```ts
import { enableDocs } from "apex14";

enableDocs({
  title: "My Company API",
  version: "1.0.0",
  docsPath: "/docs",       // Swagger UI interaktif
  specPath: "/openapi.json"// Schema JSON OpenAPI murni
});
```

---

### B. Validation & Data Contracts (TypeBox)

APEX14 mengintegrasikan **TypeBox** secara langsung untuk menjamin skema validasi runtime super cepat dan inferensi tipe TypeScript statis:

```ts
import { Type, type Static, validateOrThrow } from "apex14";

// 1. Buat Schema
export const OrderSchema = Type.Object({
  orderId: Type.String({ format: "uuid" }),
  amount: Type.Number({ minimum: 1 }),
  items: Type.Array(Type.String({ minLength: 1 })),
  paymentMethod: Type.Union([Type.Literal("credit_card"), Type.Literal("bank_transfer")]),
  notes: Type.Optional(Type.String())
});

// 2. Ekstrak TypeScript Type otomatis
export type OrderInput = Static<typeof OrderSchema>;

// 3. Pasang langsung di route options
route("/orders", async ({ body }) => {
  // 'body' di sini memiliki tipe OrderInput dengan validasi runtime 100% aman
  return { success: true, orderId: body.orderId };
}, {
  method: "POST",
  body: OrderSchema
});
```

---

### C. Database & Zero-Query ORM Engine

APEX14 menyediakan ORM fluent query builder dan driver SQLite bawaan tanpa dependensi compiler C++ eksternal.

#### 1. Konfigurasi Database (`configureDatabase`)
```ts
import { configureDatabase } from "apex14";

// SQLite file lokal
const client = configureDatabase("sqlite:./data/app.db");

// SQLite in-memory (sangat cepat untuk unit test)
const memoryClient = configureDatabase(":memory:");

// Menjalankan raw DDL table migration
await client.execute(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL
  )
`);
```

#### 2. Fluent Query Builder (`db()`)
```ts
import { db } from "apex14";

// SELECT dengan kriteria where & ordering
const users = await db("users")
  .select("id", "name", "email")
  .where("role", "=", "admin")
  .where("age", ">=", 21)
  .orderBy("created_at", "DESC")
  .limit(10)
  .offset(0)
  .get();

// Cari satu record berdasarkan ID
const user = await db("users").findById("usr_123");

// Ambil record pertama yang cocok
const alex = await db("users").where("email", "alex@example.com").first();

// INSERT record baru
await db("users").create({
  id: "usr_456",
  name: "Bob",
  email: "bob@example.com"
});

// UPDATE record berdasarkan ID
await db("users").updateById("usr_456", {
  name: "Bob Updated"
});

// DELETE record
await db("users").deleteById("usr_456");

// COUNT & Agregasi
const totalAdmins = await db("users").where("role", "admin").count();
const isExist = await db("users").where("email", "admin@apex14.dev").exists();

// ACID Transactions
await client.transaction(async (tx) => {
  await tx.execute("UPDATE accounts SET balance = balance - 100 WHERE id = 1");
  await tx.execute("UPDATE accounts SET balance = balance + 100 WHERE id = 2");
});
```

#### 3. Zero-Query Auto Model (`model()`)
Bebas menulis raw DDL! Tabel otomatis diinferensikan dan dibuat dari skema TypeBox:

```ts
import { model, Type } from "apex14";

const Customer = model("customers", Type.Object({
  name: Type.String(),
  email: Type.String({ format: "email" }),
  membership: Type.String({ default: "standard" })
}), {
  timestamps: true, // auto created_at & updated_at
  softDelete: true  // auto deleted_at
});

const newCustomer = await Customer.create({ name: "Rina", email: "rina@example.com" });
const allCustomers = await Customer.all();
await Customer.delete(newCustomer.id); // Soft deleted otomatis!
```

---

### D. Enterprise Security & Authentication (JWT, Hash, Guard)

#### 1. WebCrypto JWT Engine (`Jwt`)
Menggunakan WebCrypto native kelas satu (HS256) dengan timing-safe constant time verification:

```ts
import { Jwt } from "apex14";

const SECRET = "your-super-secret-key-min-32-chars-long";

// Sign Token
const token = await Jwt.sign(
  { sub: "user_123", email: "dev@apex14.com", role: "admin" },
  SECRET,
  { expiresIn: "7d", issuer: "apex14" }
);

// Verify Token
const payload = await Jwt.verify(token, SECRET);
console.log(payload.sub, payload.email);
```

#### 2. Timing-Safe Password Hashing (`hashPassword`, `verifyPassword`)
Menggunakan algoritma Scrypt / Argon2 anti timing-attack dengan salt acak:

```ts
import { hashPassword, verifyPassword } from "apex14";

// Hashing kata sandi saat register
const hashedPassword = await hashPassword("UserSecretPassword123!");

// Verifikasi saat login
const isValid = await verifyPassword("UserSecretPassword123!", hashedPassword);
if (!isValid) throw new AuthenticationError("Kata sandi salah");
```

#### 3. Custom Guards (`guard()`)
Guard mengevaluasi konteks request sebelum middleware dan handler berjalan:

```ts
import { guard, AuthenticationError, AuthorizationError } from "apex14";

// Daftarkan guard "auth"
guard("auth", async (ctx) => {
  const authHeader = ctx.headers["authorization"] || ctx.request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AuthenticationError("Bearer token wajib disediakan");
  }
  const token = authHeader.slice(7);
  const user = await Jwt.verify(token, process.env.JWT_SECRET!);
  ctx.state.user = user; // Sisipkan ke context state
  return true;
});

// Daftarkan guard "admin"
guard("admin", (ctx) => {
  if (ctx.state?.user?.role !== "admin") {
    throw new AuthorizationError("Akses ditolak: Membutuhkan role admin");
  }
  return true;
});

// Pasang pada rute
route("/admin/finance", () => ({ secretRevenue: 1000000 }), {
  guard: ["auth", "admin"]
});
```

#### 4. Proteksi Global (`secure()`)
```ts
import { secure } from "apex14";

secure({
  cors: {
    origin: ["https://myfrontend.com"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"]
  },
  rateLimit: {
    max: 100,            // Maksimal 100 request
    windowMs: 60 * 1000  // Per 1 menit
  }
});
```

---

### E. Storage & Secure File Uploads

APEX14 menyertakan abstraksi penyimpanan aman dengan pengecekan *magic-byte file signatures* untuk mencegah serangan eksekusi file berbahaya (.php/.sh yang disamarkan sebagai .png):

```ts
import { route, store, configureStorage, LocalStorageProvider, ValidationError } from "apex14";

// Inisialisasi storage direktori
configureStorage(new LocalStorageProvider("./data/uploads"));

route("/api/upload", async (ctx) => {
  const rawBody = await ctx.request.arrayBuffer();
  const buffer = Buffer.from(rawBody);
  const filename = ctx.headers["x-filename"] || "upload.bin";
  const mimeType = ctx.headers["content-type"] || "application/octet-stream";

  // Simpan file
  const metadata = await store().save(buffer, { filename });

  return {
    success: true,
    id: metadata.id,
    filename: metadata.name,
    size: metadata.size,
    path: metadata.path
  };
}, {
  method: "POST",
  guard: "auth"
});
```

---

### F. Middleware, Context & Error Handling

#### Request Context (`ApexRequestContext`)
Setiap rute menerima objek context `ctx` yang kaya akan informasi request dan helper:

| Properti / Method | Tipe | Deskripsi |
|---|---|---|
| `ctx.request` | `Request` | Objek Web Standard Request bawaan runtime |
| `ctx.body` | `any` | Body request yang sudah diparse dan tervalidasi |
| `ctx.params` | `Record<string, string>` | Parameter dinamis URL (`:id`, `:slug`) |
| `ctx.query` | `Record<string, string>` | Query string parameter (`?page=1&limit=10`) |
| `ctx.headers` | `Record<string, string>` | Dictionary header HTTP huruf kecil |
| `ctx.state` | `Record<string, any>` | Objek penyimpanan data antar middleware/guard (e.g. `ctx.state.user`) |
| `ctx.ip` | `string` | IP address klien (resolusi otomatis dari proxy/load balancer) |
| `ctx.url` | `URL` | Objek URL request |
| `ctx.status(code)` | `this` | Mengatur kode status HTTP respons (e.g. `ctx.status(201)`) |

#### Standar Exception HTTP
APEX14 menyertakan kelas error standar yang otomatis diserialisasi ke format RFC-7807 Problem Details:

```ts
import {
  ValidationError,      // 400 Bad Request
  AuthenticationError,  // 401 Unauthorized
  AuthorizationError,   // 403 Forbidden
  NotFoundError,        // 404 Not Found
  ConflictError,        // 409 Conflict
  RateLimitError        // 429 Too Many Requests
} from "apex14";

route("/user", ({ query }) => {
  if (!query.id) throw new ValidationError("Query parameter ?id wajib diisi");
  throw new NotFoundError("User tidak ditemukan");
});
```

---

### G. Real-Time Primitives (SSE & WebSockets)

#### Server-Sent Events (`sse`)
Gunakan generator async untuk streaming data satu arah (sangat cocok untuk LLM Token Streaming / AI Chat):

```ts
import { sse } from "apex14";

sse("/ai/stream", async function* (ctx) {
  const prompt = ctx.query.prompt;
  yield { event: "start", data: { prompt } };

  for (let i = 1; i <= 5; i++) {
    await new Promise((r) => setTimeout(r, 200));
    yield { event: "token", data: `Token chunk #${i} ` };
  }

  yield { event: "done", data: { finished: true } };
});
```

#### WebSockets (`ws`)
Komunikasi dua arah berkecepatan tinggi dengan room pub/sub bawaan:

```ts
import { ws } from "apex14";

ws("/ws/chat/:roomId", {
  open: (peer) => {
    peer.join(peer.params.roomId);
    peer.publish(peer.params.roomId, `User ${peer.id} bergabung ke ruangan`);
  },
  message: (peer, message) => {
    // Broadcast pesan ke seluruh anggota room
    peer.publish(peer.params.roomId, message);
  },
  close: (peer) => {
    peer.leave(peer.params.roomId);
  }
});
```

---

### H. Background Tasks & Scheduler

#### Worker Task Dispatcher (`task()`)
Eksekusi pekerjaan berat di background tanpa memblokir siklus respons HTTP:

```ts
import { task, route } from "apex14";

// 1. Definisikan task
export const sendWelcomeEmail = task("sendWelcomeEmail", async (data: { email: string; name: string }) => {
  await mailerService.send(data.email, `Halo ${data.name}!`);
  return { delivered: true };
});

// 2. Dispatch task secara non-blocking
route("/register", async ({ body }) => {
  const user = await User.create(body);
  await sendWelcomeEmail.dispatch({ email: user.email, name: user.name });
  return { registered: true };
});
```

#### Cron Scheduler (`schedule()`)
Penjadwalan interval pekerjaan otomatis tanpa dependensi cron sistem operasi:

```ts
import { schedule } from "apex14";

// Setiap 30 menit
schedule("30m", async () => {
  console.log("Membersihkan session kadaluarsa...");
  await db("sessions").where("expires_at", "<", new Date().toISOString()).delete();
});

// Menggunakan interval ekspresi
schedule("1h", () => {
  console.log("Sinkronisasi metrik berkala...");
});
```

---

### I. OpenAPI Documentation & Developer Studio

APEX14 mengintegrasikan auto-documentation tanpa konfigurasi YAML manual:

```ts
import { enableDocs, route, Type } from "apex14";

enableDocs({
  title: "E-Commerce Enterprise API",
  version: "2.0.0",
  docsPath: "/docs",
  specPath: "/openapi.json"
});

route("/checkout", async ({ body }) => {
  return { orderId: "ord_123", status: "paid" };
}, {
  method: "POST",
  summary: "Submit Keranjang Belanja",
  description: "Memproses checkout pesanan dan melakukan penagihan pembayaran",
  tags: ["Checkout"],
  body: Type.Object({ cartId: Type.String() })
});
```

Kunjungi `http://localhost:3000/docs` di browser untuk mengakses visual console Swagger/Scalar.

---

### J. Testing Engine (Sub-Millisecond E2E)

APEX14 memiliki `testRequest()` yang memungkinkan pengujian rute secara in-memory murni tanpa perlu membuka socket port TCP/HTTP OS yang lambat:

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { testRequest } from "apex14";
import { bootstrapApp } from "../src/app.js";

describe("Application E2E Test", () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = ":memory:";
    await bootstrapApp();
  });

  it("Menguji respons rute /health", async () => {
    const res = await testRequest("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("operational");
  });

  it("Menguji POST dengan validasi schema", async () => {
    const res = await testRequest("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@apex14.dev", password: "wrong" })
    });
    expect(res.status).toBe(401);
  });
});
```

---

### K. 30 Quantum-Leap Advanced Primitives

APEX14 dilengkapi dengan 30 modul enterprise terintegrasi langsung:

1. **`auth`**: Direct engine session & credentials auto-route handler.
2. **`workflow`**: Durable multi-step saga workflow dengan auto rollback kompensasi.
3. **`live`**: Reactive SSE live-query yang otomatis mengirim push update saat data model berubah.
4. **`heal`**: Flight recorder exception capture yang merekam error 500 beserta snapshot state untuk self-healing AI.
5. **`contract`**: Dual-mode contract SDK yang memadukan OpenAPI, validasi runtime, dan client typing dalam 1 definisi.
6. **`agent`**: Mount autonomous AI Agent tools ke dalam endpoint API streaming secara instan.
7. **`exportMcpTools`**: Membuka protokol Model Context Protocol (MCP) server JSON-RPC 2.0 untuk AI agent (Cursor, Claude, OpenAI).
8. **`tenant`**: Kernel-level row-level multi-tenancy yang otomatis mengisolasi query data per organisasi/penyewa.
9. **`audit`**: Temporal time-traveling audit log untuk mengecek data historis pada titik waktu masa lalu (`User.asOf("2026-01-01")`).
10. **`event`**: Transactional outbox event-driven pub/sub yang menjamin pengiriman pesan atomik dengan database.
11. **`chaos`**: Chaos engineering simulator untuk simulasi latency acak dan error injeksi di staging.
12. **`geo`**: Geo-routing cerdas yang mengarahkan trafik request ke replica database terdekat berdasarkan lokasi region.
13. **`lock`**: Distributed atomic mutex lock untuk mencegah race condition pada operasi kritis (seperti saldo bank).
14. **`throttle`**: Multi-tier dynamic rate limiting berdasarkan API Key atau tingkatan paket (Free, Pro, Enterprise).
15. **`verify`**: Cryptographic request attestation dan verifikasi signature webhook partner.
16. **`mock`**: Instant synthetic data generator yang otomatis membuat data tiruan realistis dari skema TypeBox.
17. **`patch`**: Zero-downtime hot-patching untuk mengganti logika rute in-memory tanpa mematikan proses server.
18. **`wasm`**: Sandbox isolasi WebAssembly untuk mengeksekusi kode biner dengan alokasi memori terkendali.
19. **`delta`**: RFC 6902 JSON patch & diff engine untuk sinkronisasi state parsial.
20. **`policy`**: Attribute-Based Access Control (ABAC) untuk penegakan aturan izin dinamis.
21. **`stream`**: Zero-memory backpressured data streaming pipeline (ETL query ke NDJSON/CSV).
22. **`replay`**: Deterministic cassette flight recorder untuk merekam dan memutar ulang bug produksi di komputer lokal.
23. **`snapshot`**: Golden-master contract regression testing dengan masking dinamis otomatis.
24. **`sdk`**: Polyglot SDK generator otomatis dalam TypeScript, Python, Go, dan Dart.
25. **`vector`**: Embedded in-memory vector similarity index (Cosine/Euclidean) untuk semantic search.
26. **`feature`**: Dynamic feature flags dengan alokasi persentase rollout dan targeting tenant.
27. **`mask`**: AI Privacy Shield yang otomatis menyamarkan data sensitif PII (Kartu kredit, email, NIK/SSN).
28. **`guardrail`**: Pertahanan prompt injection untuk aplikasi LLM dan auto schema repairer.
29. **`migrate`**: Zero-CLI schema migrator yang mendeteksi perubahan skema TypeBox dan menjalankan `ALTER TABLE` otomatis.
30. **`metric`**: Prometheus APM & OpenTelemetry metrics engine yang menyediakan endpoint `/_metrics`.

---

## CLI Tooling Reference

CLI APEX14 menyediakan serangkaian perintah untuk produktivitas developer:

```bash
# 1. Membuat proyek baru dengan template standar modular
npx create-apex14 my-api

# 2. Diagnostik environment dan kesiapan sistem
npx apex14 doctor

# 3. Menampilkan seluruh tabel routing yang terdaftar di proyek aktif
npx apex14 routes

# 4. Generate komponen secara otomatis
npx apex14 generate route orders
npx apex14 generate middleware timer
npx apex14 generate schema invoice

# 5. Jalankan micro-benchmark performa rute
npx apex14 benchmark /health --duration 2000 --requests 1000
```

---

## Benchmark Performa

Pengujian mikro-benchmark riil pada Apple Silicon (macOS Darwin ARM64, Node v24.5.0):

```bash
pnpm bench
```

| Pola Rute | Throughput (ops/sec) | Rata-rata Latensi | Catatan Arsitektur v0.3.0 |
|---|---|---|---|
| Root Static (`/`) | **22,218,498** ops/detik | **45 ns/op** | Zero-split char-code traversal |
| Deep Static (`/api/v1/health/detailed`) | **17,681,590** ops/detik | **57 ns/op** | O(1) Radix static table lookup (+530% speedup) |
| Single Param (`/users/:id`) | **4,111,953** ops/detik | **243 ns/op** | Pre-allocated capture buffer |
| Wildcard Route (`/static/*filepath`) | **3,571,039** ops/detik | **280 ns/op** | Zero-allocation prefix scanner |
| Multi-Param (`/org/:o/prj/:p/iss/:i`) | **1,400,081** ops/detik | **714 ns/op** | Safe scoped param mapping |

---

## Fitur Unggulan Enterprise (v0.3.0)

### 1. Universal Serverless & Next.js App Router Helper
Hubungkan backend APEX14 ke Next.js (App Router `app/api/[...apex]/route.ts`) atau platform serverless (Vercel, AWS Lambda, Cloudflare Workers):

```ts
// app/api/[...apex]/route.ts
import { createFetchHandler } from "apex14";
import "./server-routes"; // Mendaftarkan route(), db(), guard(), dll.

export const { GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD } = createFetchHandler({
  basePath: "/api"
});
```

### 2. Distributed State Driver & Redis Adapter (`@apex14/adapter-redis`)
Sinkronisasikan rate limiting, distributed lock, cache, dan live reactive pub/sub di seluruh cluster multi-node:

```ts
import { useDistributedState } from "apex14";
import { RedisStateDriver } from "@apex14/adapter-redis";

// Aktifkan Redis untuk state terdistribusi
useDistributedState(new RedisStateDriver({
  url: process.env.REDIS_URL || "redis://localhost:6379"
}));
```

### 3. ORM Relations & Single-Query Batch Loading (Anti N+1)
Relasi `hasMany` dan `belongsTo` dimuat secara otomatis menggunakan single batch query (`WHERE fk IN (...)`), menjamin performa konstan tanpa masalah N+1:

```ts
import { model, hasMany, belongsTo, Type } from "apex14";

const User = model("users", Type.Object({ name: Type.String() }));
const Post = model("posts", Type.Object({ title: Type.String(), user_id: Type.Integer() }));

User.hasMany("posts", Post, { foreignKey: "user_id" });
Post.belongsTo("author", User, { foreignKey: "user_id" });

// Muat User beserta seluruh Post dalam 1 query batch
const usersWithPosts = await User.include("posts").all();
```

### 4. End-to-End Type Inference untuk Client (`@apex14/client`)
Client HTTP dengan autocomplete TypeScript penuh untuk path, parameter, body, query, dan tipe respons:

```ts
import { createApexClient } from "apex14";

interface AppRoutes {
  users: {
    get: { response: Array<{ id: number; name: string }>; query?: { page?: number } };
    post: { body: { name: string; email: string }; response: { id: number; name: string } };
  };
}

const client = createApexClient<AppRoutes>("http://localhost:3000");

// Tipe data response dan body otomatis terinferensikan secara presisi
const user = await client.users.post({
  body: { name: "Alice", email: "alice@apex14.dev" }
});
```

---

## Struktur Monorepo

```text
apex14/
├── packages/
│   ├── apex14/            # Umbrella package utama (Direct Function API)
│   ├── core/               # Kernel, Scope, context AsyncLocalStorage & DistributedStateDriver
│   ├── router/             # Radix-tree Trie Router berkecepatan tinggi (17.6M+ ops/sec)
│   ├── http/               # Universal Request Context, exception handling & serializer
│   ├── validation/         # Validasi TypeBox & schema contract engine
│   ├── security/           # JWT, Scrypt, distributed rate limiter, CORS, SSRF guard
│   ├── storage/            # File management, signatures & LocalStorageProvider
│   ├── database/           # SQLite/PG/MySQL driver, ORM relations & batch loader
│   ├── client/             # End-to-end type-safe client RPC (@apex14/client)
│   ├── runtime-node/       # Adapter Node.js Dual-Engine Fast Path & WebSockets
│   ├── runtime-bun/        # Adapter Bun.serve native
│   ├── adapter-redis/      # Redis distributed state adapter (rateLimit, lock, cache)
│   ├── cli/                # CLI engine (@apex14/cli)
│   └── create-apex14/      # Scaffolding generator (npx create-apex14)
```
│   └── create-apex14/      # Scaffolder generator (create-apex14)
├── examples/               # Contoh aplikasi siap pakai
└── benchmarks/             # Suite pengujian performa benchmark
```

---

## Lisensi

APEX14 dilisensikan di bawah lisensi terbuka [MIT License](LICENSE).
Bebas digunakan untuk proyek komersial maupun personal.
