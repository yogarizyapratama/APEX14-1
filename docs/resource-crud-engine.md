# APEX14 — CRUD Resource Engine

Building standard CRUD (Create, Read, Update, Delete, List) APIs usually requires repetitive boilerplate across controllers, queries, and validation. APEX14 solves this with the `resource()` engine.

---

## 1. Zero-Boilerplate Resource Declaration

```ts
import { resource, Type, run } from "apex14";

// 1. Declare resource
resource("products", {
  database: "main",
  schema: Type.Object({
    title: Type.String({ minLength: 3 }),
    price: Type.Number({ minimum: 0 }),
    category: Type.String()
  }),
  allowedFields: ["title", "price", "category"],
  pagination: { default: 20, max: 100 }
});

run(3000);
```

In just 10 lines of code, APEX14 automatically generates and mounts 5 production-ready endpoints:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/products` | List records with pagination (`?page=1&limit=20`) |
| `GET` | `/products/:id` | Retrieve single record by ID |
| `POST` | `/products` | Create record with schema validation & 201 response |
| `PUT` | `/products/:id` | Update record fields by ID |
| `DELETE` | `/products/:id` | Delete record by ID |

---

## 2. Mass Assignment Prevention (`allowedFields`)

In insecure frameworks, accepting arbitrary client payloads can allow users to inject admin privileges (`{ role: "admin", isVerified: true }`).

In APEX14, `allowedFields` strictly filters incoming fields before inserting or updating:

```ts
resource("users", {
  allowedFields: ["name", "email", "bio"] // 'role', 'password_hash', 'id' are automatically stripped!
});
```

---

## 3. Protecting Resources with Guards

You can attach authentication or authorization guards to the entire resource:

```ts
resource("invoices", {
  guard: "auth", // Requires guard 'auth' for all 5 CRUD operations
  database: "main"
});
```

---

## 4. Soft Deletes

Enable soft deletes so records are flagged rather than permanently dropped:

```ts
resource("articles", {
  softDelete: true // Sets deleted_at = CURRENT_TIMESTAMP instead of DELETE
});
```

When `softDelete: true` is configured, `GET /articles` and `GET /articles/:id` automatically filter out deleted records (`WHERE deleted_at IS NULL`).
