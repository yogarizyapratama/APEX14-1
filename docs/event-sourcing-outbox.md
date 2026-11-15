# Event Sourcing & Transactional Outbox Engine (`event`)

In distributed microservices, publishing events directly to brokers like Kafka or RabbitMQ during database mutations is prone to the *dual-write problem* — if the server crashes after writing to the database but before sending the event, data becomes inconsistent.

APEX14 solves this with a built-in **Transactional Outbox Engine**.

---

## 1. Defining Events

```ts
import { event, route } from "apex14";

export const UserSignedUp = event<{ userId: string; email: string }>("user.signed_up");
```

---

## 2. Publishing Events

### Immediate Publish
```ts
await UserSignedUp.publish({ userId: "usr_10", email: "user@example.com" });
```

### Transactional Outbox Publish (Guaranteed Delivery)
```ts
route("/signup", async ({ body }) => {
  const user = await User.create(body);

  // Safely stored in the local outbox queue in the same transaction:
  await UserSignedUp.publish({ userId: user.id, email: user.email }, {
    transactional: true
  });

  return user;
});
```

---

## 3. Subscribing to Events

```ts
UserSignedUp.subscribe(async ({ userId, email }) => {
  await Mailer.sendWelcomeEmail(email);
});
```

---

## 4. Flushing the Outbox

```ts
import { event } from "apex14";

// Process pending or retry failed outbox items
const processedCount = await event.flushOutbox();
```
