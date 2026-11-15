# Durable Step Functions & Distributed Saga Workflows (`workflow`)

In modern distributed architectures, multi-step API operations (e.g. charging a payment card $\to$ reserving cloud infrastructure $\to$ notifying external webhooks) are vulnerable to server crashes or timeout failures.

APEX14 features a native **Zero-DevOps Durable Execution Engine** inspired by Temporal and Inngest, requiring **zero external daemons, brokers, or cloud accounts**.

---

## 1. Defining a Workflow

```ts
import { workflow, route } from "apex14";

export const orderFulfillment = workflow("order-fulfillment", async (ctx, payload: { orderId: string; amount: number; userEmail: string }) => {
  // Step 1: Idempotent step (executed exactly once)
  const reservation = await ctx.step("reserve-inventory", async () => {
    return await Inventory.reserve(payload.orderId);
  }, {
    rollback: async () => {
      // Saga compensation: released automatically if any subsequent step fails!
      await Inventory.release(payload.orderId);
    }
  });

  // Step 2: Payment Gateway with automatic exponential jittered retries
  const payment = await ctx.step("charge-card", async () => {
    return await Stripe.charges.create({ amount: payload.amount });
  }, {
    retries: 3,
    backoffMs: 100
  });

  // Step 3: Durable Sleep (resumes safely across process restarts!)
  await ctx.sleep("24h");

  // Step 4: Follow-up notification
  await ctx.step("send-followup-email", async () => {
    return await Mailer.send(payload.userEmail, "Your receipt & guide");
  });

  return { success: true, paymentId: payment.id, reservationId: reservation.id };
});
```

---

## 2. Triggering Workflows in Routes

```ts
route("/checkout", {
  POST: async ({ body }) => {
    const run = await orderFulfillment.trigger({
      orderId: body.orderId,
      amount: body.amount,
      userEmail: body.email
    });

    return {
      runId: run.runId,
      status: run.status,
      startedAt: run.startedAt
    };
  }
});
```

---

## 3. Saga Compensation Pattern (Automatic Rollbacks)

When an unhandled exception occurs at any point in the workflow handler or in a step whose retries are exhausted, APEX14 automatically traverses all previously succeeded steps in **reverse order** and executes their registered `rollback` handlers, ensuring complete transaction consistency.

---

## 4. APEX14 Studio Integration

All registered workflows and their runs are automatically rendered in the **Durable Workflows** tab of `/_studio`, displaying:
- Workflow status (`completed`, `running`, `failed`).
- Step-by-step audit logs and timing.
- Input payloads and return outputs.
