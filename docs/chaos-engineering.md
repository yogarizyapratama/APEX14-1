# Native Chaos Engineering Simulator (`chaos`)

Validating circuit breakers, timeouts, and retry policies in staging usually requires complicated proxy infrastructure. APEX14 includes a programmatic chaos injection engine directly in the framework.

---

## 1. Injecting Faults & Jitter

```ts
import { chaos } from "apex14";

// Inject chaos in staging environments
chaos.inject({
  routes: ["/payments/*", "/third-party/*"],
  latencyMs: { min: 200, max: 1200 }, // Injects latency jitter
  failureRate: 0.15, // 15% random HTTP 503 failures
  errorStatus: 503,
  errorMessage: "Downstream partner network timeout",
  enableWhen: () => process.env.NODE_ENV === "staging"
});
```

---

## 2. Resetting Chaos

```ts
chaos.reset();
```

---

## 3. Pairing with `resilient()`

Verify that your routes automatically withstand downstream faults:

```ts
import { resilient, route } from "apex14";

const fetchPartnerData = resilient(async () => {
  return await fetch("http://localhost/third-party/data");
}, {
  retries: 3,
  backoffMs: 50,
  circuitBreaker: { failureThreshold: 0.5, minimumRequests: 5 }
});

route("/dashboard", async () => {
  // Survives simulated chaos with automatic retries and fallback
  return await fetchPartnerData();
});
```
