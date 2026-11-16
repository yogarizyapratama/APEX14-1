import type { DistributedStateDriver } from "@apex14/core";

export interface RedisClientInterface {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: any[]): Promise<any>;
  del(key: string): Promise<number>;
  eval(script: string, numkeys: number, ...args: any[]): Promise<any>;
  publish(channel: string, message: string): Promise<number>;
  subscribe?(channel: string, callback: (message: string) => void): Promise<any> | void;
  on?(event: string, callback: (...args: any[]) => void): any;
  duplicate?(): RedisClientInterface;
  quit?(): Promise<any>;
}

export interface RedisStateDriverOptions {
  client?: RedisClientInterface | any;
  url?: string;
  keyPrefix?: string;
}

export class RedisStateDriver implements DistributedStateDriver {
  private client: RedisClientInterface;
  private prefix: string;
  private subClient?: RedisClientInterface;
  private subscribers = new Map<string, Set<(data: any) => void>>();

  constructor(options: RedisStateDriverOptions = {}) {
    this.prefix = options.keyPrefix || "apex14:";
    if (options.client) {
      this.client = options.client;
    } else {
      // Internal in-memory fallback mock if client is not provided
      const memStore = new Map<string, { val: string; exp?: number }>();
      this.client = {
        async get(key: string) {
          const item = memStore.get(key);
          if (!item) return null;
          if (item.exp && Date.now() > item.exp) {
            memStore.delete(key);
            return null;
          }
          return item.val;
        },
        async set(key: string, value: string, ...args: any[]) {
          let exp: number | undefined;
          for (let i = 0; i < args.length; i++) {
            if (String(args[i]).toUpperCase() === "PX" && args[i + 1]) {
              exp = Date.now() + Number(args[i + 1]);
            } else if (String(args[i]).toUpperCase() === "EX" && args[i + 1]) {
              exp = Date.now() + Number(args[i + 1]) * 1000;
            } else if (String(args[i]).toUpperCase() === "NX") {
              if (memStore.has(key)) return null;
            }
          }
          memStore.set(key, { val: value, exp });
          return "OK";
        },
        async del(key: string) {
          return memStore.delete(key) ? 1 : 0;
        },
        async eval(script: string, numkeys: number, ...args: any[]) {
          const key = args[0];
          // Lua lock release simulation
          if (script.includes("redis.call('get'")) {
            const token = args[1];
            const item = memStore.get(key);
            if (item && item.val === token) {
              memStore.delete(key);
              return 1;
            }
            return 0;
          }
          // Lua rate limit simulation
          if (script.includes("INCR")) {
            const windowMs = Number(args[1]);
            const item = memStore.get(key);
            let count = 1;
            let exp = Date.now() + windowMs;
            if (item) {
              count = parseInt(item.val, 10) + 1;
              exp = item.exp || exp;
            }
            memStore.set(key, { val: String(count), exp });
            const ttl = Math.max(0, exp - Date.now());
            return [count, ttl];
          }
          return null;
        },
        async publish() {
          return 1;
        }
      };
    }
  }

  private k(key: string): string {
    return `${this.prefix}${key}`;
  }

  public async hitRateLimit(
    key: string,
    limit: number,
    windowMs: number
  ): Promise<{ allowed: boolean; remaining: number; resetMs: number }> {
    const redisKey = this.k(`ratelimit:${key}`);
    const script = `
      local current = redis.call('INCR', KEYS[1])
      if current == 1 then
        redis.call('PEXPIRE', KEYS[1], ARGV[1])
      end
      local ttl = redis.call('PTTL', KEYS[1])
      return {current, ttl}
    `;

    try {
      const res = await this.client.eval(script, 1, redisKey, String(windowMs));
      const count = Number(res[0]);
      const ttl = Number(res[1]);
      const remaining = Math.max(0, limit - count);
      return {
        allowed: count <= limit,
        remaining,
        resetMs: ttl > 0 ? ttl : windowMs
      };
    } catch {
      // Safe fallback
      return { allowed: true, remaining: limit - 1, resetMs: windowMs };
    }
  }

  public async acquireLock(key: string, ttlMs: number): Promise<string | null> {
    const redisKey = this.k(`lock:${key}`);
    const token = `lock_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    try {
      const res = await this.client.set(redisKey, token, "PX", ttlMs, "NX");
      if (res === "OK" || res === true) {
        return token;
      }
      return null;
    } catch {
      return null;
    }
  }

  public async releaseLock(key: string, token: string): Promise<boolean> {
    const redisKey = this.k(`lock:${key}`);
    const script = `
      if redis.call('get', KEYS[1]) == ARGV[1] then
        return redis.call('del', KEYS[1])
      else
        return 0
      end
    `;

    try {
      const res = await this.client.eval(script, 1, redisKey, token);
      return Number(res) === 1;
    } catch {
      return false;
    }
  }

  public async publish(channel: string, message: any): Promise<void> {
    const redisChannel = this.k(`pubsub:${channel}`);
    const payload = typeof message === "string" ? message : JSON.stringify(message);

    // Notify local subscribers
    const local = this.subscribers.get(channel);
    if (local) {
      for (const handler of Array.from(local)) {
        try {
          handler(message);
        } catch {}
      }
    }

    try {
      await this.client.publish(redisChannel, payload);
    } catch {
      // Safe ignore
    }
  }

  public async subscribe(channel: string, handler: (data: any) => void): Promise<() => void> {
    let subs = this.subscribers.get(channel);
    if (!subs) {
      subs = new Set();
      this.subscribers.set(channel, subs);
    }
    subs.add(handler);

    return () => {
      subs?.delete(handler);
    };
  }

  public async getCache(key: string): Promise<any | null> {
    const redisKey = this.k(`cache:${key}`);
    try {
      const raw = await this.client.get(redisKey);
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    } catch {
      return null;
    }
  }

  public async setCache(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const redisKey = this.k(`cache:${key}`);
    const payload = typeof value === "string" ? value : JSON.stringify(value);
    try {
      if (ttlSeconds && ttlSeconds > 0) {
        await this.client.set(redisKey, payload, "EX", ttlSeconds);
      } else {
        await this.client.set(redisKey, payload);
      }
    } catch {
      // Safe ignore
    }
  }
}

export function createRedisStateDriver(options: RedisStateDriverOptions = {}): RedisStateDriver {
  return new RedisStateDriver(options);
}
