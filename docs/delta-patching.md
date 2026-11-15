# RFC 6902 JSON Patch & Incremental Sync (`delta`)

Sending full JSON payloads across the wire on every minor update wastes bandwidth, drains mobile battery, and increases network serialization latency. APEX14 features a native RFC 6902 JSON Patch engine for computing minimal diffs, applying patches atomically, and wrapping HTTP `PATCH` endpoints.

---

## 1. Computing Diff & Applying Patches

```ts
import { delta } from "apex14";

const original = {
  name: "Alex",
  settings: { theme: "light", notifications: true },
  roles: ["editor"]
};

const updated = {
  name: "Alex",
  settings: { theme: "dark", notifications: true },
  roles: ["editor", "admin"]
};

// 1. Compute minimal RFC 6902 operations
const patches = delta.diff(original, updated);
// [
//   { op: "replace", path: "/settings/theme", value: "dark" },
//   { op: "add", path: "/roles/1", value: "admin" }
// ]

// 2. Apply patches immutably
const nextState = delta.apply(original, patches);
```

---

## 2. Direct HTTP PATCH Route Wrapper (`delta.patch`)

Wrap your route with `delta.patch()` to automatically receive validated patch operations and update entities:

```ts
import { delta, route, db } from "apex14";

route("/api/documents/:id", {
  PATCH: delta.patch(async (id, patches) => {
    const doc = await db("documents").find(id);
    const patched = delta.apply(doc, patches);
    await db("documents").update(id, patched);
    
    // Return only the applied delta or updated entity
    return delta.diff(doc, patched);
  })
});
```
