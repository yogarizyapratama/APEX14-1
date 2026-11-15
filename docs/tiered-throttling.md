# Tiered Rate Limiting & Token Cluster (`throttle`)

Standard rate limiters apply a single uniform threshold across all callers. APEX14 provides a multi-tenant, tiered token bucket rate limiter with cost weighting and automatic standard response headers (`x-ratelimit-*`, `retry-after`).

---

## 1. Quick Usage

```ts
import { throttle, route } from "apex14";

const limiter = throttle({
  tiers: {
    free: { limit: 100, window: "1m" },
    pro: { limit: 1000, window: "1m" },
    enterprise: { limit: 10000, window: "1m" }
  },
  resolveTier: (ctx) => ctx.headers["x-plan"] || "free",
  key: (ctx) => ctx.headers["x-api-key"] || ctx.ip
});

route("/api/v1/search", (ctx) => ({ results: [] }), {
  middleware: [limiter]
});
```

---

## 2. Dynamic Cost Weighting

Heavier operations (e.g. image processing or vector search) can consume more tokens per request:

```ts
const aiLimiter = throttle({
  cost: (ctx) => (ctx.url.pathname.includes("/batch") ? 5 : 1)
});

route("/api/ai/generate", handler, { middleware: [aiLimiter] });
```

---

## 3. Standard Headers Emitted

When a request passes or hits the threshold, APEX14 automatically injects industry-standard RFC headers:

- `x-ratelimit-limit`: Total allowance in window.
- `x-ratelimit-remaining`: Remaining tokens before lockout.
- `x-ratelimit-reset`: Seconds until window resets.
- `retry-after`: Emitted with HTTP 429 when quota is exhausted.
