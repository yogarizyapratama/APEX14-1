# Schema-Driven Synthetic Mock Engine (`mock`)

Building frontend applications before the backend is finished or generating realistic test fixtures often requires third-party fake data libraries. APEX14 includes a native, TypeBox schema-driven synthetic mock engine with seeded PRNG.

---

## 1. Generating Mock Data from Schemas

Generate realistic dummy data directly matching your contract schemas:

```ts
import { mock, Type } from "apex14";

const UserContract = Type.Object({
  id: Type.String(),
  email: Type.String({ format: "email" }),
  name: Type.String(),
  age: Type.Integer({ minimum: 18, maximum: 60 }),
  avatar: Type.String({ format: "url" }),
  role: Type.Union([Type.Literal("admin"), Type.Literal("user")])
});

// Generate single object
const dummyUser = mock.one(UserContract);

// Generate deterministic data using seed
const testUser = mock.one(UserContract, { seed: 1337 });

// Generate multiple items
const userList = mock.many(UserContract, 10, { seed: 42 });
```

---

## 2. Serving Instant Mock Endpoints (`mock.fn`)

Plug schema mock generators directly into routes:

```ts
import { mock, route, Type } from "apex14";

const MetricsSchema = Type.Object({
  cpuUsage: Type.Number({ minimum: 10, maximum: 90 }),
  memoryUsageMb: Type.Integer({ minimum: 512, maximum: 4096 }),
  status: Type.Union([Type.Literal("ok"), Type.Literal("degraded")])
});

// Serves synthetic metrics data matching schema with 0 boilerplate
route("/api/v1/metrics", mock.fn(MetricsSchema));
```

---

## 3. Custom Field Overrides

```ts
const adminUser = mock.one(UserContract, {
  overrides: {
    role: "admin",
    email: "sysadmin@enterprise.internal"
  }
});
```
