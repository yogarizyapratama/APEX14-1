# APEX14 — Live OpenAPI 3.1 & Interactive Docs Engine

APEX14 automatically extracts metadata and TypeBox schemas from your route definitions to produce **OpenAPI 3.1 specifications** and serve an interactive API playground with **zero external configuration**.

---

## 1. Enabling Interactive Documentation

Add `docs: true` to `run()`:

```ts
import { route, Type, run } from "apex14";

const UserSchema = Type.Object({
  name: Type.String({ minLength: 2 }),
  email: Type.String({ format: "email" }),
  role: Type.String({ default: "member" })
});

route("/users", {
  GET: () => User.all(),
  POST: ({ body }) => User.create(body)
}, {
  summary: "User Management",
  description: "Create or retrieve user accounts",
  tags: ["Users"],
  body: UserSchema
});

// Enable interactive playground on /_docs
run({
  port: 3000,
  docs: true,
  docsPath: "/_docs" // Optional, default is /_docs
});
```

Open `http://localhost:3000/_docs` in your browser to explore:
- Modern Scalar API reference UI (responsive, dark/light theme).
- Interactive "Test Request" console.
- Auto-generated curl, JavaScript, Python, and Go request snippets.
- Raw OpenAPI 3.1 JSON available at `http://localhost:3000/_openapi.json`.

---

## 2. Programmatic OpenAPI Spec Retrieval

You can also fetch the OpenAPI 3.1 spec directly in code:

```ts
import { getOpenApiSpec } from "apex14";

const spec = getOpenApiSpec({
  title: "My Company API",
  version: "2.0.0"
});

console.log(spec.openapi); // "3.1.0"
```
