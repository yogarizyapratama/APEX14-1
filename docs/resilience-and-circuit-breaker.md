# APEX14 — Native Resilience: Circuit Breaker & Retries

APEX14 includes an enterprise-grade resilience engine to prevent cascading failures when communicating with external microservices, AI providers, and payment gateways.

---

## 1. Quick Example: `resilient()`

```ts
import { resilient } from "apex14";

export const callPaymentGateway = resilient(async (paymentData: any) => {
  const res = await fetch("https://api.stripe.com/v1/charges", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.STRIPE_KEY}` },
    body: JSON.stringify(paymentData)
  });
  if (!res.ok) throw new Error("Payment gateway failure");
  return await res.json();
}, {
  retries: 3,                 // Retry up to 3 times
  backoff: "exponential",     // Exponential backoff (delay * 2^attempt)
  retryDelayMs: 300,          // Base delay in milliseconds
  timeoutMs: 5000,            // Cancel attempt if taking longer than 5 seconds
  circuitBreaker: {
    failureThreshold: 0.5,    // Trip circuit to OPEN if 50% of requests fail
    minimumRequests: 5,       // Minimum sample size before evaluating
    resetTimeoutMs: 30000     // Test downstream recovery after 30 seconds
  }
});
```

---

## 2. Circuit Breaker States

```
        ┌──────────────────────────────────────────────┐
        │                                              │
        ▼                                              │ Success
   ┌──────────┐    Failure Rate >= 50%    ┌──────────┐ │
   │  CLOSED  │ ────────────────────────> │   OPEN   │ │
   └──────────┘                           └──────────┘ │
        ▲                                      │       │
        │                                      │ 30s   │
        │ Success                              │ reset │
        │                                      ▼       │
        │                                 ┌───────────┐│
        └──────────────────────────────── │ HALF_OPEN │┘
                                          └───────────┘
                                                │ Failure
                                                ▼ (Trip back to OPEN)
```

- **CLOSED (Normal):** Requests pass through. Failures and successes are tracked.
- **OPEN (Tripped):** Immediately throws `CircuitBreakerOpenError` without hitting downstream services.
- **HALF_OPEN (Testing):** Allows one canary request through. If it succeeds, circuit resets to `CLOSED`; if it fails, it trips back to `OPEN`.
