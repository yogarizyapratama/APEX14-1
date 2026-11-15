# APEX14 — TypeBox Validation & Contracts

APEX14 features an end-to-end type safety and validation engine built on **TypeBox** (`@sinclair/typebox`). It compiles JSON Schemas into ultra-fast JavaScript validation functions while providing 100% static TypeScript type inference.

---

## 1. Quick Example

```ts
import { route, Type, type Static } from "apex14";

// 1. Define schema
export const CreateUserSchema = Type.Object({
  name: Type.String({ minLength: 2, maxLength: 50 }),
  email: Type.String({ format: "email" }),
  age: Type.Optional(Type.Number({ minimum: 0, maximum: 150 })),
  role: Type.Optional(Type.Union([
    Type.Literal("admin"),
    Type.Literal("member")
  ]))
});

// 2. TypeScript Static Type Inference
export type CreateUser = Static<typeof CreateUserSchema>;

// 3. Attach schema to route
route("/users", {
  POST: ({ body }) => {
    // 'body' is automatically typed and validated!
    return {
      status: "created",
      user: body
    };
  }
}, {
  body: CreateUserSchema
});
```

---

## 2. Validation Targets

You can validate request bodies, query parameters, route parameters, and outgoing responses:

```ts
const ParamsSchema = Type.Object({
  id: Type.String({ pattern: "^[0-9]+$" })
});

const QuerySchema = Type.Object({
  page: Type.Optional(Type.String()),
  limit: Type.Optional(Type.String())
});

route("/posts/:id", {
  GET: ({ params, query }) => ({
    postId: params.id,
    page: query.page || "1"
  })
}, {
  params: ParamsSchema,
  query: QuerySchema
});
```

---

## 3. Standard Supported Formats

APEX14 comes with pre-registered standard JSON Schema format validators:
- `email`: RFC-compliant email verification.
- `uuid`: v1-v5 UUID syntax validation.
- `date-time`: ISO-8601 date string validation.
- `url`: Valid absolute HTTP/HTTPS URL syntax.
- `ipv4`: IPv4 dotted-decimal syntax.

```ts
const AccountSchema = Type.Object({
  userId: Type.String({ format: "uuid" }),
  email: Type.String({ format: "email" }),
  website: Type.String({ format: "url" }),
  createdAt: Type.String({ format: "date-time" })
});
```

---

## 4. Standardized Validation Error Responses

When invalid input is received, APEX14 halts execution and automatically returns an HTTP 400 Bad Request with field-level details:

```json
{
  "error": {
    "message": "Invalid request body — /email: Expected string to match 'email' format",
    "code": "VALIDATION_ERROR",
    "status": 400,
    "details": [
      {
        "path": "/email",
        "message": "Expected string to match 'email' format",
        "value": "invalid-email-address",
        "type": "54"
      }
    ]
  }
}
```

---

## 5. Programmatic Validation

You can also validate any data directly in service or domain logic:

```ts
import { validateSchema, validateOrThrow, Type } from "apex14";

const NumberList = Type.Array(Type.Number());

// Returns { valid: boolean, value, errors }
const res = validateSchema(NumberList, [1, 2, "three"]);
if (!res.valid) {
  console.log(res.errors);
}

// Or throws ValidationError directly if invalid
const numbers = validateOrThrow(NumberList, [1, 2, 3]);
```
