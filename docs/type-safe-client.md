# APEX14 — End-to-End Type-Safe Client (`@apex14/client`)

`@apex14/client` provides an ultra-ergonomic, type-safe RPC client for frontend applications (React, Next.js, Vue, Svelte, React Native) consuming APEX14 APIs without code generation.

---

## 1. Installation

```bash
pnpm add @apex14/client
# or: npm install @apex14/client
```

---

## 2. Usage in Frontend

```ts
import { createApexClient } from "@apex14/client";

// Initialize client
const api = createApexClient("https://api.myapp.com", {
  headers: () => ({
    authorization: `Bearer ${localStorage.getItem("token")}`
  })
});

// 1. GET request with query params -> GET /users?role=admin&limit=10
const users = await api.users.get({
  query: { role: "admin", limit: 10 }
});

// 2. Dynamic path parameters -> GET /users/42
const user = await api.users(42).get();

// 3. POST request with JSON body -> POST /users
const newUser = await api.users.post({
  body: {
    name: "Alex",
    email: "alex@example.com"
  }
});

// 4. PUT request -> PUT /users/42
await api.users(42).put({
  body: { name: "Alex Updated" }
});

// 5. DELETE request -> DELETE /users/42
await api.users(42).delete();
```

---

## 3. Error Handling

When the server returns a 4xx or 5xx status code, the client throws a typed `ApexClientError`:

```ts
import { createApexClient, ApexClientError } from "@apex14/client";

try {
  await api.users(999).get();
} catch (err) {
  if (err instanceof ApexClientError) {
    console.error(`Status: ${err.status}`); // 404
    console.error(`Error details:`, err.data);
  }
}
```
