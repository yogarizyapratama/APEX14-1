import type { DistributedDriver } from "./types.js";

export class MemoryDistributedDriver implements DistributedDriver {
  public name = "memory";

  private cacheStore = new Map<string, { value: any; expiresAt: number }>();
  private rateLimitStore = new Map<string, { timestamps: number[] }>();
  private lockStore = new Map<string, { lockId: string; expiresAt: number }>();
  private taskQueues = new Map<string, any[]>();
  private subscribers = new Map<string, Set<(message: string) => void>>();

  // Cache Operations
  public async cacheGet<T = any>(key: string): Promise<T | null> {
    const entry = this.cacheStore.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cacheStore.delete(key);
      return null;
    }
    return entry.value as T;
  }

  public async cacheSet<T = any>(key: string, value: T, ttlMs: number = 60000): Promise<void> {
    this.cacheStore.set(key, {
      value,
      expiresAt: Date.now() + ttlMs
    });
  }

  public async cacheDel(key: string): Promise<void> {
    this.cacheStore.delete(key);
  }

  // Rate Limiting Operations (Sliding Window)
  public async rateLimitIncrement(
    key: string,
    windowMs: number
  ): Promise<{ count: number; resetMs: number }> {
    const now = Date.now();
    let record = this.rateLimitStore.get(key);
    if (!record) {
      record = { timestamps: [] };
      this.rateLimitStore.set(key, record);
    }

    const windowStart = now - windowMs;
    record.timestamps = record.timestamps.filter((t) => t > windowStart);
    record.timestamps.push(now);

    const oldest = record.timestamps[0] || now;
    const resetMs = Math.max(0, oldest + windowMs - now);

    return {
      count: record.timestamps.length,
      resetMs
    };
  }

  // Distributed Lock Operations (Atomic Mutex)
  public async lockAcquire(key: string, ttlMs: number, lockId: string): Promise<boolean> {
    const now = Date.now();
    const existing = this.lockStore.get(key);

    if (existing) {
      if (now < existing.expiresAt) {
        return false; // Still held by someone
      }
      this.lockStore.delete(key);
    }

    this.lockStore.set(key, {
      lockId,
      expiresAt: now + ttlMs
    });
    return true;
  }

  public async lockRelease(key: string, lockId: string): Promise<boolean> {
    const existing = this.lockStore.get(key);
    if (!existing) return false;

    if (existing.lockId === lockId) {
      this.lockStore.delete(key);
      return true;
    }
    return false; // Not owner
  }

  // Distributed Task Queue Operations
  public async taskPush<T = any>(queueName: string, payload: T): Promise<void> {
    let queue = this.taskQueues.get(queueName);
    if (!queue) {
      queue = [];
      this.taskQueues.set(queueName, queue);
    }
    queue.push(payload);
  }

  public async taskPop<T = any>(queueName: string, timeoutMs: number = 0): Promise<T | null> {
    const queue = this.taskQueues.get(queueName);
    if (queue && queue.length > 0) {
      return queue.shift() as T;
    }

    if (timeoutMs <= 0) return null;

    // Polling simulation for wait timeout
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      await new Promise((r) => setTimeout(r, 20));
      const q = this.taskQueues.get(queueName);
      if (q && q.length > 0) {
        return q.shift() as T;
      }
    }
    return null;
  }

  // Pub/Sub Messaging
  public async publish(channel: string, message: string): Promise<void> {
    const handlers = this.subscribers.get(channel);
    if (handlers) {
      for (const fn of handlers) {
        try {
          fn(message);
        } catch (e) {
          console.error(`[Distributed Memory Driver] Subscriber error on ${channel}:`, e);
        }
      }
    }
  }

  public async subscribe(
    channel: string,
    handler: (message: string) => void
  ): Promise<() => void> {
    let set = this.subscribers.get(channel);
    if (!set) {
      set = new Set();
      this.subscribers.set(channel, set);
    }
    set.add(handler);

    return () => {
      set?.delete(handler);
    };
  }

  public async ping(): Promise<boolean> {
    return true;
  }

  public async close(): Promise<void> {
    this.cacheStore.clear();
    this.rateLimitStore.clear();
    this.lockStore.clear();
    this.taskQueues.clear();
    this.subscribers.clear();
  }
}
