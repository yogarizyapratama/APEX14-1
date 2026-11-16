export interface DistributedStateDriver {
  hitRateLimit(
    key: string,
    limit: number,
    windowMs: number
  ): Promise<{ allowed: boolean; remaining: number; resetMs: number }>;
  acquireLock(key: string, ttlMs: number): Promise<string | null>;
  releaseLock(key: string, token: string): Promise<boolean>;
  publish(channel: string, message: any): Promise<void>;
  subscribe(channel: string, handler: (data: any) => void): Promise<() => void>;
  getCache(key: string): Promise<any | null>;
  setCache(key: string, value: any, ttlSeconds?: number): Promise<void>;
}

interface CacheEntry {
  value: any;
  expiresAt?: number;
}

interface LockEntry {
  token: string;
  expiresAt: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export class MemoryStateDriver implements DistributedStateDriver {
  private cache = new Map<string, CacheEntry>();
  private locks = new Map<string, LockEntry>();
  private rateLimits = new Map<string, RateLimitEntry>();
  private subscribers = new Map<string, Set<(data: any) => void>>();

  public async hitRateLimit(
    key: string,
    limit: number,
    windowMs: number
  ): Promise<{ allowed: boolean; remaining: number; resetMs: number }> {
    const now = Date.now();
    let entry = this.rateLimits.get(key);

    if (!entry || now >= entry.resetAt) {
      entry = { count: 1, resetAt: now + windowMs };
      this.rateLimits.set(key, entry);
      return {
        allowed: true,
        remaining: Math.max(0, limit - 1),
        resetMs: windowMs
      };
    }

    if (entry.count < limit) {
      entry.count++;
      return {
        allowed: true,
        remaining: Math.max(0, limit - entry.count),
        resetMs: Math.max(0, entry.resetAt - now)
      };
    }

    return {
      allowed: false,
      remaining: 0,
      resetMs: Math.max(0, entry.resetAt - now)
    };
  }

  public async acquireLock(key: string, ttlMs: number): Promise<string | null> {
    const now = Date.now();
    const existing = this.locks.get(key);

    if (existing && now < existing.expiresAt) {
      return null;
    }

    const token = `lock_${now}_${Math.random().toString(36).substring(2, 9)}`;
    this.locks.set(key, { token, expiresAt: now + ttlMs });
    return token;
  }

  public async releaseLock(key: string, token: string): Promise<boolean> {
    const existing = this.locks.get(key);
    if (existing && existing.token === token) {
      this.locks.delete(key);
      return true;
    }
    return false;
  }

  public async publish(channel: string, message: any): Promise<void> {
    const subs = this.subscribers.get(channel);
    if (subs) {
      for (const handler of Array.from(subs)) {
        try {
          handler(message);
        } catch {
          // Safe ignore subscriber handler errors
        }
      }
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
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() >= entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }

  public async setCache(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
    this.cache.set(key, { value, expiresAt });
  }

  public clear(): void {
    this.cache.clear();
    this.locks.clear();
    this.rateLimits.clear();
    this.subscribers.clear();
  }
}

let activeDriver: DistributedStateDriver = new MemoryStateDriver();
(globalThis as any).__apex14_state_driver = activeDriver;

export function useDistributedState(driver: DistributedStateDriver): void {
  activeDriver = driver;
  (globalThis as any).__apex14_state_driver = driver;
}

export function getDistributedStateDriver(): DistributedStateDriver {
  return activeDriver;
}

export function resetDistributedState(): void {
  activeDriver = new MemoryStateDriver();
  (globalThis as any).__apex14_state_driver = activeDriver;
}
