# Semantic Contract Regression & Golden-Master Engine (`snapshot`)

Traditional snapshot tests are brittle because dynamic fields (timestamps, auto-increment IDs, session tokens, UUIDs) change on every test run. APEX14's `snapshot` primitive performs semantic dynamic masking, verifying structure, types, and contract invariants without false positives.

---

## 1. Verifying API Responses Against Golden Masters

```ts
import { snapshot, testRequest } from "apex14";

it("ensures zero semantic regression on /api/user/profile", async () => {
  const res = await testRequest("/api/user/profile");
  const data = await res.json();

  // Automatically masks ISO dates, UUIDs, and custom dynamic keys
  snapshot.verify("user-profile-v1", data, {
    ignoreDynamic: ["sessionToken", "requestId"]
  });
});
```

---

## 2. Semantic Dynamic Masking

`snapshot.maskSemantic()` converts unstable dynamic values into deterministic structural tokens:

- ISO 8601 strings (`2026-11-15T12:00:00Z`) $\rightarrow$ `<ISO_DATE>`
- Standard UUID v4 (`550e8400-e29b-41d4-a716-446655440000`) $\rightarrow$ `<UUID>`
- Dynamic fields configured in `ignoreDynamic` $\rightarrow$ `<DYNAMIC_VALUE>`

---

## 3. Detailed Structural Diff on Failure

If an API regression introduces a missing field or alters a type, `snapshot.verify` throws a `SnapshotMismatchError` with precise path-level diffs:

```text
SnapshotMismatchError: Snapshot mismatch for key 'user-profile-v1':
  • Missing property at '/profile/avatarUrl'
  • Type mismatch at '/settings/notifications': expected type 'boolean', received 'string'
```
