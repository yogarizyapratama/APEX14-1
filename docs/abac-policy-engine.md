# Attribute-Based Access Control (ABAC) Engine (`policy`)

Role-Based Access Control (RBAC) like `isAdmin` is too coarse for real-world enterprise architectures. APEX14 includes a declarative ABAC engine where access decisions depend on dynamic user attributes, target resource state, and request context.

---

## 1. Defining Policies

```ts
import { policy } from "apex14";

policy.define("document:edit", (user, doc, ctx) => {
  if (!user) return false;
  // Superadmin can edit anything
  if (user.role === "admin") return true;
  // Authors can edit draft documents in their department
  return user.departmentId === doc?.departmentId && doc?.status === "draft";
});
```

---

## 2. Declarative Route Enforcement

Pass policy directly into route options:

```ts
import { route, policy, db } from "apex14";

route("/api/documents/:id", async (ctx) => {
  return await db("documents").update(ctx.params.id, ctx.body);
}, {
  method: "PUT",
  policy: {
    name: "document:edit",
    getResource: (ctx) => db("documents").find(ctx.params.id)
  }
});
```

---

## 3. Imperative Authorization

You can also check permissions imperatively inside services or background jobs:

```ts
// Returns boolean
const canEdit = await policy.allows(user, "document:edit", doc);

// Throws AuthorizationError (HTTP 403) if denied
await policy.authorize(user, "document:edit", doc);
```
