# APEX14 — Full ORM & Zero-Query Database Engine

APEX14 comes with a built-in, zero-dependency, ultra-intuitive ORM engine designed to **completely eliminate raw/pure SQL queries** from application code.

### Core Philosophy
- **Zero Raw Queries**: No `CREATE TABLE`, `SELECT *`, or string concatenations required.
- **Auto Table Generation**: Database tables are automatically inferred from TypeBox schemas and generated on demand.
- **Auto Timestamps & Soft Deletes**: Automatic `created_at`, `updated_at`, and `deleted_at` handling.
- **Zero-Dependency SQLite**: Backed natively by modern embedded SQLite (`DatabaseSync`), saving state without external database servers.

---

## 1. Quick Start: The Zero-Query Model

```ts
import { route, model, Type, run } from "apex14";

// 1. Define schema & model (Zero SQL! Table is auto-created automatically)
const UserSchema = Type.Object({
  name: Type.String(),
  email: Type.String({ format: "email" }),
  role: Type.String({ default: "member" })
});

export const User = model("users", UserSchema);

// 2. Direct Function Routes using the Model
route("/users", {
  // Get all users
  GET: () => User.all(),

  // Create user
  POST: ({ body }) => User.create(body)
});

route("/users/:id", {
  // Find user by ID
  GET: ({ params }) => User.find(params.id),

  // Update user
  PUT: ({ params, body }) => User.update(params.id, body),

  // Delete user
  DELETE: ({ params }) => User.delete(params.id)
});

run(3000);
```

---

## 2. Model API Reference (`model()`)

### 2.1 Model Options

```ts
const Product = model("products", ProductSchema, {
  timestamps: true,  // Automatically manages created_at and updated_at (default: true)
  softDelete: true   // Sets deleted_at on delete() and filters out deleted rows on all() (default: false)
});
```

### 2.2 Inserting Records

```ts
// Create single record (returns created row with generated id and timestamps)
const user = await User.create({
  name: "Alex",
  email: "alex@example.com",
  role: "admin"
});
console.log(user.id); // 1
console.log(user.created_at); // "2026-11-15T11:00:00.000Z"

// Bulk insert
const users = await User.createMany([
  { name: "Jordan", email: "jordan@example.com" },
  { name: "Taylor", email: "taylor@example.com" }
]);
```

### 2.3 Querying Records

```ts
// 1. Fetch all active records
const allUsers = await User.all();

// 2. Find by primary key (id)
const user = await User.find(42);
// or: await User.findById(42);

// 3. Find one record matching conditions
const admin = await User.findOne({ email: "admin@apex14.dev" });

// 4. Find many with structured options
const members = await User.findMany({
  where: { role: "member" },
  orderBy: { created_at: "desc" },
  limit: 20,
  offset: 0
});
```

### 2.4 Fluent Query Chaining on Models

The `User` model also provides fluent query chaining:

```ts
const topUsers = await User
  .where("role", "admin")
  .where("score", ">=", 90)
  .orderBy("created_at", "DESC")
  .limit(10)
  .get();

// Count
const totalAdmins = await User.where("role", "admin").count();

// First match
const firstActive = await User.where("status", "active").first();
```

### 2.5 Updating Records

```ts
// Update by ID directly
const updated = await User.update(1, {
  name: "Alex Updated"
});

// Update with condition
await User.update({ role: "pending" }, { role: "member" });
```

### 2.6 Deleting Records

```ts
// Hard delete (or soft delete if softDelete: true)
const success = await User.delete(1);

// Delete with conditions
await User.delete({ role: "inactive" });
```

---

## 3. Automatic Schema Inference

When you supply a TypeBox schema to `model("name", schema)`, APEX14 maps the types to SQLite column definitions:

| TypeBox Property | Inferred Column Type |
|---|---|
| `Type.String()` | `TEXT` |
| `Type.Integer()` | `INTEGER` |
| `Type.Number()` | `REAL` |
| `Type.Boolean()` | `INTEGER` (0 or 1) |
| `id` (reserved) | `INTEGER PRIMARY KEY AUTOINCREMENT` |
| `created_at` (timestamps: true) | `DATETIME DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` (timestamps: true) | `DATETIME DEFAULT CURRENT_TIMESTAMP` |
| `deleted_at` (softDelete: true) | `DATETIME DEFAULT NULL` |

---

## 4. Fluent Table Query Builder (`db("tableName")`)

If you prefer building queries directly on arbitrary tables without defining a model schema:

```ts
import { db } from "apex14";

const results = await db("orders")
  .select("id", "total", "customer_id")
  .where("total", ">", 100)
  .where({ status: "completed" })
  .orderBy("id", "DESC")
  .limit(50)
  .get();
```

---

## 5. Instant CRUD Resources in 1 Line (`resource()`)

For instant production REST APIs, combine models with the `resource()` engine:

```ts
import { resource, Type } from "apex14";

resource("tasks", {
  schema: Type.Object({
    title: Type.String({ minLength: 3 }),
    completed: Type.Boolean({ default: false })
  }),
  allowedFields: ["title", "completed"],
  pagination: { default: 10, max: 100 }
});
```

This single declaration immediately serves:
- `GET /tasks` (with pagination `?page=1&limit=10`)
- `GET /tasks/:id`
- `POST /tasks` (with full TypeBox body validation)
- `PUT /tasks/:id` (with update validation)
- `DELETE /tasks/:id`

---

## 6. Atomic Transactions

Execute multiple mutations atomically:

```ts
await db.transaction(async (tx) => {
  await tx.execute("UPDATE accounts SET balance = balance - 100 WHERE id = ?", [1]);
  await tx.execute("UPDATE accounts SET balance = balance + 100 WHERE id = ?", [2]);
});
```

---

## 7. Multi-Database Drivers (Postgres, MySQL, Turso)

APEX14 comes with embedded zero-dependency SQLite by default, but you can seamlessly switch to production cloud databases by passing a connection string to `configureDatabase`:

```ts
import { configureDatabase } from "apex14";

// 1. Embedded SQLite in-memory (Default)
configureDatabase("sqlite::memory:");

// 2. Persistent local SQLite file
configureDatabase("sqlite://./production.db");

// 3. PostgreSQL Database
configureDatabase(process.env.DATABASE_URL || "postgres://user:password@localhost:5432/mydb");

// 4. MySQL Database
configureDatabase("mysql://root:password@localhost:3306/mydb");
```

Your `model("users", schema)` and `db("table")` code remains **100% identical** across SQLite, Postgres, and MySQL with zero code rewrites!
