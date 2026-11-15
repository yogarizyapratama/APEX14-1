# APEX14 — Background Tasks & In-Memory Scheduler

APEX14 comes with a zero-dependency, non-blocking asynchronous task queue and job scheduler. No Redis or external workers required for background processing.

---

## 1. Background Task Queues via `task()`

Execute background operations (sending transactional emails, processing webhooks, resizing images) without blocking the HTTP request-response cycle:

```ts
import { task, route, run } from "apex14";

// 1. Define asynchronous background task
export const sendWelcomeEmail = task("sendWelcomeEmail", async (data: { email: string; name: string }) => {
  await mailer.send({
    to: data.email,
    subject: `Welcome ${data.name} to APEX14!`
  });
  return { delivered: true };
}, {
  concurrency: 5,   // Process up to 5 tasks concurrently
  retries: 3,       // Auto-retry up to 3 times on failure
  retryDelayMs: 1000 // 1-second delay between retries
});

// 2. Dispatch non-blocking in route handler
route("/register", {
  POST: async ({ body }) => {
    // Non-blocking dispatch — returns immediate 200 OK to the client!
    sendWelcomeEmail.dispatch({
      email: body.email,
      name: body.name
    });

    return { success: true, message: "User registered" };
  }
});

run(3000);
```

### Awaiting Execution with `runNow()`
When you need to await the execution directly (e.g. in test suites or synchronous endpoints):
```ts
const result = await sendWelcomeEmail.runNow({ email: "test@example.com", name: "Alex" });
console.log(result.delivered); // true
```

---

## 2. In-Memory Job Scheduler via `schedule()`

Schedule recurring background jobs with natural interval strings or cron expressions:

```ts
import { schedule, model } from "apex14";

// 1. Run using readable interval strings ("30s", "5m", "2h", "1d")
schedule("10m", async () => {
  console.log("Running cache cleanup every 10 minutes...");
});

// 2. Run with named options
const syncJob = schedule({ name: "sync-external-crm", interval: "1h" }, async () => {
  await syncWithSalesforce();
});

// Stop the job at any time:
syncJob.stop();
```
