# Native Distributed Locks & Atomic Mutex (`lock`)

Race conditions in financial transactions, inventory decrements, and concurrent background jobs can corrupt state. APEX14 features a zero-dependency, auto-releasing distributed mutex primitive right out of the box.

---

## 1. Protecting Critical Sections

Wrap critical asynchronous logic with `lock()`. If another request tries to acquire the same resource concurrently, it safely waits in queue or times out:

```ts
import { lock, route } from "apex14";

route("/api/orders/checkout", async (ctx) => {
  const { accountId, amount } = ctx.body;

  return await lock(`account:${accountId}`, { ttlMs: 5000, timeoutMs: 3000 }, async () => {
    const user = await db.user.find(accountId);
    if (user.balance < amount) {
      throw new ConflictError("Insufficient funds");
    }

    await db.user.update(accountId, { balance: user.balance - amount });
    return { success: true, newBalance: user.balance - amount };
  });
});
```

---

## 2. Configuration Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `ttlMs` | `number` | `5000` | Maximum time to hold lock before automatic lease expiration (deadlock defense). |
| `timeoutMs` | `number` | `3000` | Maximum time caller will wait in queue before throwing `LockAcquisitionError`. |
| `retryDelayMs` | `number` | `25` | Interval between polling attempts while waiting for release. |

---

## 3. Manual Acquisition & Explicit Release

You can also acquire and release locks imperatively:

```ts
import { lockEngine } from "apex14";

const lockId = await lockEngine.acquire("cron:nightly-sync", { ttlMs: 30000 });
try {
  await runNightlySync();
} finally {
  lockEngine.release("cron:nightly-sync", lockId);
}
```
