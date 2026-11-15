# APEX14 — Native Webhook Engine & Idempotency

APEX14 eliminates the tedious boilerplate of webhook handling: raw body verification, HMAC cryptographic checks, and duplicate delivery protection are handled in one unified function.

---

## 1. Stripe Webhooks

```ts
import { webhook, model, run } from "apex14";

const Order = model("orders", OrderSchema);

webhook("/webhooks/stripe", {
  provider: "stripe",
  secret: process.env.STRIPE_WEBHOOK_SECRET!,
  idempotent: true, // Automatically ignores duplicate webhook deliveries
  handler: async (event) => {
    // Event is fully verified cryptographically via WebCrypto HMAC-SHA256
    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object;
      await Order.update({ id: paymentIntent.metadata.orderId }, { status: "paid" });
    }
    return { received: true };
  }
});

run(3000);
```

---

## 2. GitHub Webhooks

```ts
webhook("/webhooks/github", {
  provider: "github",
  secret: process.env.GITHUB_WEBHOOK_SECRET!,
  handler: async (event, ctx) => {
    console.log(`Received GitHub event: ${ctx.headers["x-github-event"]}`);
    if (event.action === "opened") {
      console.log(`Issue opened: #${event.issue.number}`);
    }
  }
});
```

---

## 3. Idempotency Protection

When `idempotent: true` is configured:
1. APEX14 inspects the incoming event ID (`event.id`, `x-github-delivery`, or `idempotency-key`).
2. If the event ID was already processed, APEX14 short-circuits immediately with `{ received: true, idempotent: true, skipped: true }` and HTTP status `200`.
3. Your handler is **guaranteed to execute at most once** per event.
