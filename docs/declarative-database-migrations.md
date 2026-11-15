# Declarative Zero-CLI Schema Migrator (`migrate`)

Managing database schema evolution usually requires separate CLI commands, manual migration files, and complex ORM tooling. APEX14 allows programmatic schema diffing directly from TypeBox contracts.

---

## 1. Schema Diffing & Migration Planning

```ts
import { migrate, Type } from "apex14";

const UserSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  email: Type.String(),
  phone: Type.String() // Newly added column
});

// Compare existing DB columns against updated schema
const existingColumns = ["id", "name", "email"];
const plan = migrate.plan("users", existingColumns, UserSchema, "sqlite");

console.log(plan.sqlStatements);
// [ 'ALTER TABLE "users" ADD COLUMN "phone" TEXT;' ]
```

---

## 2. Automated Safe Startup Sync

```ts
import { migrate, db } from "apex14";

// Register schemas
migrate.register("users", UserSchema);
migrate.register("orders", OrderSchema);

// Safely execute all pending ALTER TABLE and CREATE TABLE statements
await migrate.sync(db);
```
