# Temporal Time-Travel Data Auditing (`audit`)

APEX14 provides a built-in Change Data Capture (CDC) and temporal auditing engine designed to meet enterprise compliance standards (SOC 2, ISO 27001, HIPAA) with zero external setup.

---

## 1. Enabling Audit on Models

```ts
import { model, Type } from "apex14";

export const Organization = model("organizations", Type.Object({
  name: Type.String(),
  tier: Type.String()
}), {
  audit: true // Automatically captures every create, update, and delete!
});
```

---

## 2. Inspecting Audit History

```ts
import { audit } from "apex14";

const history = audit.getHistory("organizations", 42);
// Returns an array of change logs:
// [
//   {
//     id: "aud_123",
//     action: "update",
//     diff: { tier: { before: "starter", after: "enterprise" } },
//     timestamp: "2026-11-15T12:00:00.000Z"
//   }
// ]
```

---

## 3. Time-Travel Queries (`asOf`)

Reconstruct the exact state of any record at an arbitrary point in history:

```ts
// View the organization record as it existed on New Year's Day
const pastState = Organization.asOf("2026-01-01T00:00:00.000Z").findById(42);
console.log("Historical Tier:", pastState.tier);
```
