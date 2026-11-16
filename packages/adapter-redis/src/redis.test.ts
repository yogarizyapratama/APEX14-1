import { describe, it, expect } from "vitest";
import { RedisStateDriver, createRedisStateDriver } from "./index.js";

describe("@apex14/adapter-redis", () => {
  it("implements DistributedStateDriver interface with rate limiting, locks, cache, and pubsub", async () => {
    const driver = createRedisStateDriver();

    // 1. Rate Limiting
    const r1 = await driver.hitRateLimit("ip:127.0.0.1", 2, 1000);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(1);

    const r2 = await driver.hitRateLimit("ip:127.0.0.1", 2, 1000);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(0);

    const r3 = await driver.hitRateLimit("ip:127.0.0.1", 2, 1000);
    expect(r3.allowed).toBe(false);

    // 2. Distributed Locks
    const token = await driver.acquireLock("seat_101", 5000);
    expect(token).toBeTruthy();

    const lockedOut = await driver.acquireLock("seat_101", 5000);
    expect(lockedOut).toBeNull();

    const released = await driver.releaseLock("seat_101", token!);
    expect(released).toBe(true);

    const acquireAgain = await driver.acquireLock("seat_101", 5000);
    expect(acquireAgain).toBeTruthy();

    // 3. Cache
    await driver.setCache("user:session_99", { userId: 99, role: "admin" }, 60);
    const cached = await driver.getCache("user:session_99");
    expect(cached).toEqual({ userId: 99, role: "admin" });

    // 4. PubSub
    const msgs: any[] = [];
    const unsub = await driver.subscribe("events", (data) => msgs.push(data));
    await driver.publish("events", { event: "PAYMENT_RECEIVED", amount: 500 });
    expect(msgs.length).toBe(1);
    expect(msgs[0]).toEqual({ event: "PAYMENT_RECEIVED", amount: 500 });
    unsub();
  });
});
