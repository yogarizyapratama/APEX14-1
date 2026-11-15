# Zero-Latency Dynamic Feature Flagging (`feature`)

Traditional feature flagging services (LaunchDarkly, Statsig) introduce 50–150ms network hops on every request or require heavy client SDKs. APEX14 features a zero-latency, in-memory feature flag engine evaluated via deterministic FNV-1a sticky hashing.

---

## 1. Defining Flags & Rollout Policies

```ts
import { feature } from "apex14";

feature.define("canary_checkout_v2", {
  percentage: 0.20, // 20% traffic rollout
  enabledForTenants: ["enterprise_corp"],
  enabledForUsers: ["beta_tester_01"]
});
```

---

## 2. Route Gating (`feature.gate`)

Route gating allows splitting endpoint traffic between new and legacy handlers with zero boilerplate:

```ts
import { feature, route } from "apex14";

route(
  "/api/checkout",
  feature.gate(
    "canary_checkout_v2",
    modernCheckoutHandler,
    legacyCheckoutHandler
  )
);
```

---

## 3. Imperative Flag Evaluation

```ts
// Evaluates sticky percentage based on user ID or IP
if (feature.isEnabled("canary_checkout_v2", ctx)) {
  // Execute feature-flagged logic
}
```
