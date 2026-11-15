# Type-Safe Dual-Mode Contract SDK (`contract`)

Developers traditionally face a dilemma:
- **tRPC**: Exceptional fullstack TypeScript monorepo developer experience, but unusable by third-party API clients or mobile apps.
- **OpenAPI**: Universal industry standard, but requires tedious external code-generation pipelines.

APEX14 solves this with the `contract()` primitive. A single contract definition powers runtime validation, OpenAPI 3.1 documentation, MCP tool export, and type-safe frontend client consumption.

---

## 1. Defining a Contract

```ts
import { contract, route, Type } from "apex14";

export const CreateUserContract = contract({
  body: Type.Object({
    email: Type.String({ format: "email" }),
    name: Type.String({ minLength: 2 }),
    role: Type.Optional(Type.Union([Type.Literal("admin"), Type.Literal("member")]))
  }),
  response: Type.Object({
    id: Type.String(),
    email: Type.String(),
    status: Type.Literal("active")
  }),
  summary: "Create a new organization user",
  tags: ["Users"]
});
```

---

## 2. Binding Contracts to Routes

You can bind a contract in three flexible ways:

### Style A: Direct Option Passing
```ts
route("/users", CreateUserContract, ({ body }) => {
  return { id: "usr_1", email: body.email, status: "active" };
});
```

### Style B: Contract Handler
```ts
route("/users", CreateUserContract.handle(({ body }) => {
  return { id: "usr_1", email: body.email, status: "active" };
}));
```

### Style C: Method Map
```ts
route("/users", {
  POST: ({ body }) => ({ id: "usr_1", email: body.email, status: "active" })
}, CreateUserContract);
```

---

## 3. What You Get Automatically

1. **Strict TypeBox Validation**: Requests failing schema constraints are rejected immediately with structured `400 Bad Request` messages.
2. **OpenAPI 3.1 Spec**: Exported at `/_openapi.json` and viewable in Scalar at `/_docs`.
3. **AI MCP Tool**: Model Context Protocol JSON-RPC tool exported at `/_mcp`.
4. **End-to-End Client Typing**: Fully inferred client autocomplete with `@apex14/client`.
