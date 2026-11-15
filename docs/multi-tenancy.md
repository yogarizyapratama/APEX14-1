# Kernel-Level Row-Level Multi-Tenancy (`tenant`)

In multi-tenant SaaS applications, data leaks between corporate accounts occur when developers forget to add `where: { tenant_id: currentOrgId }` to database queries. APEX14 eliminates this risk with kernel-level tenant scoping.

---

## 1. Configuring Multi-Tenancy

```ts
import { tenant } from "apex14";

tenant.configure({
  header: "x-tenant-id", // Extracted automatically from HTTP headers
  cookie: "apex_tenant", // Or from cookies
  column: "tenant_id",   // Database column name automatically injected
  defaultTenant: "default"
});
```

---

## 2. Transparent Model Scoping

Once configured, **every** database query executed within the request lifecycle is automatically constrained to the active tenant without any manual filtering:

```ts
import { model, route } from "apex14";

const Invoices = model("invoices");

route("/invoices", async () => {
  // Automatically executes:
  // SELECT * FROM invoices WHERE tenant_id = 'active_tenant_id'
  return await Invoices.all();
});

route("/invoices", {
  POST: async ({ body }) => {
    // Automatically injects:
    // payload.tenant_id = 'active_tenant_id'
    return await Invoices.create(body);
  }
});
```

---

## 3. Programmatic Scoping (`withTenant`)

For background workers or cron tasks that process data on behalf of specific tenants:

```ts
import { tenant } from "apex14";

await tenant.withTenant("enterprise-corp", async () => {
  // All model queries in this block execute in the context of 'enterprise-corp'
  const accounts = await Accounts.all();
});
```
