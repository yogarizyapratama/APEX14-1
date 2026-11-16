import { describe, it, expect, beforeEach } from "vitest";
import {
  useDistributedState,
  getDistributedStateDriver,
  resetDistributedState,
  MemoryStateDriver,
  type DistributedStateDriver,
  lock,
  cache
} from "./index.js";

describe("Distributed State Driver Engine", () => {
  beforeEach(() => {
    resetDistributedState();
  });

  it("operates with MemoryStateDriver by default", async () => {
    const driver = getDistributedStateDriver();
    expect(driver).toBeInstanceOf(MemoryStateDriver);

    // Test default rate limiter
    const hit1 = await driver.hitRateLimit("user:1", 2, 1000);
    expect(hit1.allowed).toBe(true);
    expect(hit1.remaining).toBe(1);

    const hit2 = await driver.hitRateLimit("user:1", 2, 1000);
    expect(hit2.allowed).toBe(true);
    expect(hit2.remaining).toBe(0);

    const hit3 = await driver.hitRateLimit("user:1", 2, 1000);
    expect(hit3.allowed).toBe(false);

    // Test default lock
    const token = await driver.acquireLock("order:100", 5000);
    expect(token).toBeTruthy();
    const tokenConflict = await driver.acquireLock("order:100", 5000);
    expect(tokenConflict).toBeNull();
    const released = await driver.releaseLock("order:100", token!);
    expect(released).toBe(true);

    // Test default pub/sub
    const received: string[] = [];
    const unsub = await driver.subscribe("notifications", (msg) => {
      received.push(msg);
    });
    await driver.publish("notifications", "alert-1");
    await driver.publish("notifications", "alert-2");
    expect(received).toEqual(["alert-1", "alert-2"]);
    unsub();
  });

  it("switches to custom/mock distributed state driver seamlessly", async () => {
    const mockStore = new Map<string, any>();
    const mockLocks = new Set<string>();

    const mockDriver: DistributedStateDriver = {
      async hitRateLimit(key, limit, windowMs) {
        return { allowed: true, remaining: 999, resetMs: windowMs };
      },
      async acquireLock(key, ttlMs) {
        if (mockLocks.has(key)) return null;
        mockLocks.add(key);
        return "mock-token-abc";
      },
      async releaseLock(key, token) {
        if (token === "mock-token-abc" && mockLocks.has(key)) {
          mockLocks.delete(key);
          return true;
        }
        return false;
      },
      async publish(channel, message) {},
      async subscribe(channel, handler) {
        return () => {};
      },
      async getCache(key) {
        return mockStore.get(key) || null;
      },
      async setCache(key, value, ttlSeconds) {
        mockStore.set(key, value);
      }
    };

    useDistributedState(mockDriver);
    expect(getDistributedStateDriver()).toBe(mockDriver);

    // Lock engine now delegates to mock driver
    let executed = false;
    await lock("checkout:seat_42", async () => {
      expect(mockLocks.has("checkout:seat_42")).toBe(true);
      executed = true;
    });
    expect(executed).toBe(true);
    expect(mockLocks.has("checkout:seat_42")).toBe(false);

    // Cache engine delegates to mock driver
    await cache.setAsync("profile:1", { name: "Sarah" });
    const cached = await cache.getAsync("profile:1");
    expect(cached).toEqual({ name: "Sarah" });
    expect(mockStore.get("profile:1")).toEqual({ name: "Sarah" });
  });
});
