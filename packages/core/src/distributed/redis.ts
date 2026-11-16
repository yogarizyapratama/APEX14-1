import type { DistributedDriver } from "./types.js";

export interface RedisDriverOptions {
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  client?: any; // Custom injected Redis client (e.g. for testing)
}

export class RedisDistributedDriver implements DistributedDriver {
  public name = "redis";
  private options: RedisDriverOptions;
  private client: any;
  private subClient: any;
  private prefix: string;

  constructor(optionsOrUrl: string | RedisDriverOptions = "redis://127.0.0.1:6379") {
    if (typeof optionsOrUrl === "string") {
      this.options = { url: optionsOrUrl };
    } else {
      this.options = optionsOrUrl;
    }
    this.prefix = this.options.keyPrefix || "apex:";
    if (this.options.client) {
      this.client = this.options.client;
    }
  }

  private async getClient(): Promise<any> {
    if (this.client) return this.client;

    try {
      // @ts-ignore
      const ioredisModule: any = await import("ioredis" as any);
      const Redis = ioredisModule.default || ioredisModule;
      if (this.options.url) {
        this.client = new Redis(this.options.url, { lazyConnect: true });
      } else {
        this.client = new Redis({
          host: this.options.host || "127.0.0.1",
          port: this.options.port || 6379,
          password: this.options.password,
          db: this.options.db || 0,
          lazyConnect: true
        });
      }
      await this.client.connect();
      return this.client;
    } catch (err: any) {
      throw new Error(
        `Redis driver requires the 'ioredis' package. Install it using: pnpm add ioredis (${err.message})`
      );
    }
  }

  private k(key: string): string {
    return `${this.prefix}${key}`;
  }

  // Cache Operations
  public async cacheGet<T = any>(key: string): Promise<T | null> {
    const client = await this.getClient();
    const raw = await client.get(this.k(`cache:${key}`));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as any as T;
    }
  }

  public async cacheSet<T = any>(key: string, value: T, ttlMs: number = 60000): Promise<void> {
    const client = await this.getClient();
    const payload = typeof value === "string" ? value : JSON.stringify(value);
    await client.set(this.k(`cache:${key}`), payload, "PX", ttlMs);
  }

  public async cacheDel(key: string): Promise<void> {
    const client = await this.getClient();
    await client.del(this.k(`cache:${key}`));
  }

  // Rate Limiting Operations (Atomic Lua Token Counter)
  public async rateLimitIncrement(
    key: string,
    windowMs: number
  ): Promise<{ count: number; resetMs: number }> {
    const client = await this.getClient();
    const redisKey = this.k(`ratelimit:${key}`);

    // Lua script to atomically increment and set TTL if new key
    const luaScript = `
      local current = redis.call('INCR', KEYS[1])
      if current == 1 then
        redis.call('PEXPIRE', KEYS[1], ARGV[1])
      end
      local ttl = redis.call('PTTL', KEYS[1])
      if ttl < 0 then ttl = ARGV[1] end
      return {current, ttl}
    `;

    try {
      let result: any;
      if (typeof client.eval === "function") {
        result = await client.eval(luaScript, 1, redisKey, windowMs);
      } else {
        // Fallback for mock clients
        const current = (await client.incr(redisKey)) || 1;
        if (current === 1) await client.pexpire(redisKey, windowMs);
        const ttl = (await client.pttl(redisKey)) || windowMs;
        result = [current, ttl];
      }

      const count = Number(result[0]);
      const resetMs = Math.max(0, Number(result[1]));
      return { count, resetMs };
    } catch {
      // Fallback
      const count = await client.incr(redisKey);
      if (count === 1) {
        await client.pexpire(redisKey, windowMs);
      }
      return { count, resetMs: windowMs };
    }
  }

  // Distributed Lock Operations (Atomic Mutex via SET NX PX)
  public async lockAcquire(key: string, ttlMs: number, lockId: string): Promise<boolean> {
    const client = await this.getClient();
    const redisKey = this.k(`lock:${key}`);
    const res = await client.set(redisKey, lockId, "PX", ttlMs, "NX");
    return res === "OK";
  }

  public async lockRelease(key: string, lockId: string): Promise<boolean> {
    const client = await this.getClient();
    const redisKey = this.k(`lock:${key}`);

    // Atomic release Lua script: Only deletes if lock value matches lockId
    const luaScript = `
      if redis.call('GET', KEYS[1]) == ARGV[1] then
        return redis.call('DEL', KEYS[1])
      else
        return 0
      end
    `;

    try {
      let res: any;
      if (typeof client.eval === "function") {
        res = await client.eval(luaScript, 1, redisKey, lockId);
      } else {
        const currentVal = await client.get(redisKey);
        if (currentVal === lockId) {
          await client.del(redisKey);
          res = 1;
        } else {
          res = 0;
        }
      }
      return Number(res) === 1;
    } catch {
      return false;
    }
  }

  // Distributed Task Queue Operations
  public async taskPush<T = any>(queueName: string, payload: T): Promise<void> {
    const client = await this.getClient();
    const queueKey = this.k(`task:${queueName}`);
    await client.lpush(queueKey, JSON.stringify(payload));
  }

  public async taskPop<T = any>(queueName: string, timeoutMs: number = 0): Promise<T | null> {
    const client = await this.getClient();
    const queueKey = this.k(`task:${queueName}`);

    if (timeoutMs > 0 && typeof client.brpop === "function") {
      const timeoutSec = Math.max(1, Math.ceil(timeoutMs / 1000));
      const res = await client.brpop(queueKey, timeoutSec);
      if (!res || !res[1]) return null;
      try {
        return JSON.parse(res[1]) as T;
      } catch {
        return res[1] as any as T;
      }
    }

    const raw = await client.rpop(queueKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as any as T;
    }
  }

  // Pub/Sub Messaging
  public async publish(channel: string, message: string): Promise<void> {
    const client = await this.getClient();
    await client.publish(this.k(`pubsub:${channel}`), message);
  }

  public async subscribe(
    channel: string,
    handler: (message: string) => void
  ): Promise<() => void> {
    const client = await this.getClient();
    if (!this.subClient && typeof client.duplicate === "function") {
      this.subClient = client.duplicate();
      await this.subClient.connect();
    }
    const sub = this.subClient || client;
    const chName = this.k(`pubsub:${channel}`);

    await sub.subscribe(chName);
    const listener = (ch: string, msg: string) => {
      if (ch === chName) {
        handler(msg);
      }
    };
    sub.on("message", listener);

    return async () => {
      if (sub.unsubscribe) await sub.unsubscribe(chName);
      if (sub.off) sub.off("message", listener);
    };
  }

  public async ping(): Promise<boolean> {
    try {
      const client = await this.getClient();
      const res = await client.ping();
      return res === "PONG" || res === true;
    } catch {
      return false;
    }
  }

  public async close(): Promise<void> {
    if (this.subClient && typeof this.subClient.quit === "function") {
      await this.subClient.quit();
    }
    if (this.client && typeof this.client.quit === "function") {
      await this.client.quit();
    }
  }
}
