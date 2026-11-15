# APEX14 — Full ORM & Database Engine

APEX14 comes with a built-in, zero-dependency, ultra-easy ORM engine. It provides fluent query building, type-safe queries, automatic SQLite integration, atomic transactions, and automated schema helpers.

---

## 1. Quick Example

```ts
import { route, db, run } from "apex14";

// Automatically creates table if it does not exist
await db.schema.createTableIfNotExists("users", {
  id: "INTEGER PRIMARY KEY AUTOINCREMENT",
  name: "TEXT NOT NULL",
  email: "TEXT UNIQUE NOT NULL",
  role: "TEXT DEFAULT 'user'",
  created_at: "DATETIME DEFAULT CURRENT_TIMESTAMP"
});

// GET /users?role=admin
route("/users", async ({ query }) => {
  return await db("users").findMany({
    where: query.role ? { role: query.role } : undefined,
    orderBy: { id: "desc" },
    limit: 20
  });
});

// POST /users
route("/users", async ({ body }) => {
  return await db("users").create({
    name: body.name,
    email: body.email
  });
});

run(3000);
```

---

## 2. ORM Query API (`db("tableName")`)

### 2.1 Inserting Records

```ts
// Insert single record (returns created object with generated ID)
const user = await db("users").create({
  name: "Alex",
  email: "alex@example.com",
  role: "admin"
});
console.log(user.id); // 1

// Insert multiple records in bulk
const users = await db("users").createMany([
  { name: "Jordan", email: "jordan@example.com" },
  { name: "Taylor", email: "taylor@example.com" }
]);
```

### 2.2 Finding Records

#### By ID
```ts
const user = await db("users").findById(42);
// Returns null if not found
```

#### Find First (Single Record)
```ts
const admin = await db("users").findFirst({
  where: { role: "admin" }
});
```

#### Find Many with Filtering & Sorting
```ts
const activeUsers = await db("users").findMany({
  where: { role: "member" },
  orderBy: { created_at: "desc" },
  limit: 25,
  offset: 0,
  select: ["id", "name", "email"]
});
```

---

## 3. Fluent Chain Syntax

You can build queries using method chaining:

```ts
const results = await db("users")
  .select("id", "name", "role")
  .where("role", "admin")
  .where("age", ">=", 21)
  .orderBy("created_at", "DESC")
  .limit(10)
  .offset(20)
  .get();

// Retrieve first matching record
const single = await db("users")
  .where({ email: "target@example.com" })
  .first();
```

### Supported Where Operators
- Equality: `.where({ role: "admin" })` or `.where("role", "admin")`
- Comparison: `.where("score", ">=", 80)` or `.where("status", "!=", "banned")`
- Pattern matching: `.where("name", "LIKE", "%alex%")`
- IN clause: `.where({ id: [1, 2, 3] })`
- NULL checks: `.where({ deleted_at: null })`
- OR conditions: `.orWhere("role", "superadmin")`

---

## 4. Updating Records

```ts
// Update using where conditions
const { rowsAffected } = await db("users")
  .where({ id: 5 })
  .update({ name: "Alex Updated", role: "moderator" });

// Update by ID directly
const updatedUser = await db("users").updateById(5, {
  name: "Alex Updated"
});
```

---

## 5. Deleting Records

```ts
// Delete by ID
const success = await db("users").deleteById(5);

// Delete with conditions
const { rowsAffected } = await db("users")
  .where("status", "inactive")
  .delete();
```

---

## 6. Counting & Existence

```ts
// Count total records
const total = await db("users").count();

// Count with conditions
const adminCount = await db("users")
  .where({ role: "admin" })
  .count();

// Check if any matching record exists
const exists = await db("users")
  .where({ email: "test@example.com" })
  .exists(); // true | false
```

---

## 7. Atomic Transactions

Run multiple queries atomically with automatic `ROLLBACK` on failure:

```ts
await db.transaction(async (tx) => {
  await tx.execute("UPDATE accounts SET balance = balance - 100 WHERE id = ?", [1]);
  await tx.execute("UPDATE accounts SET balance = balance + 100 WHERE id = ?", [2]);
});
```

---

## 8. Schema Migrations & Table Creation

APEX14 provides clean DDL helpers:

```ts
await db.schema.createTableIfNotExists("products", {
  id: "INTEGER PRIMARY KEY AUTOINCREMENT",
  title: "TEXT NOT NULL",
  price: "REAL NOT NULL",
  stock: "INTEGER DEFAULT 0",
  created_at: "DATETIME DEFAULT CURRENT_TIMESTAMP"
});

// Drop table
await db.schema.dropTableIfExists("temp_logs");
```

---

## 9. Raw SQL Escape Hatch

When you need custom joins, window functions, or complex queries:

```ts
// Parameterized raw query
const reports = await db.raw<{ author: string; totalPosts: number }>(
  `SELECT author, COUNT(*) as totalPosts FROM articles GROUP BY author HAVING totalPosts > ?`,
  [5]
);

// Execute command
await db.execute("VACUUM");
```
