import type { ApexRequestContext } from "@apex14/http";
import { RateLimitError } from "@apex14/http";

export interface RateLimitDriver {
  rateLimitIncrement(key: string, windowMs: number): Promise<{ count: number; resetMs: number }>;
}

export interface RateLimitOptions {
  max: number;
  windowMs: number;
  keyGenerator?: (ctx: ApexRequestContext) => string;
  driver?: RateLimitDriver;
}

interface ClientRecord {
  timestamps: number[];
}

export class SlidingWindowRateLimiter {
  private clients = new Map<string, ClientRecord>();
  private max: number;
  private windowMs: number;
  private keyGenerator: (ctx: ApexRequestContext) => string;
  private driver?: RateLimitDriver;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(options: RateLimitOptions) {
    this.max = options.max;
    this.windowMs = options.windowMs;
    this.keyGenerator = options.keyGenerator || ((ctx) => ctx.ip || "127.0.0.1");
    this.driver = options.driver;

    // Periodic cleanup of stale client records every minute
    if (typeof setInterval !== "undefined") {
      this.cleanupInterval = setInterval(() => this.cleanup(), Math.max(60000, this.windowMs));
      if (this.cleanupInterval.unref) {
        this.cleanupInterval.unref();
      }
    }
  }

  public check(ctx: ApexRequestContext): { allowed: boolean; remaining: number; resetMs: number } {
    const now = Date.now();
    const key = this.keyGenerator(ctx);

    let record = this.clients.get(key);
    if (!record) {
      record = { timestamps: [] };
      this.clients.set(key, record);
    }

    // Filter out timestamps outside the sliding window
    const windowStart = now - this.windowMs;
    record.timestamps = record.timestamps.filter((t) => t > windowStart);

    const count = record.timestamps.length;
    const remaining = Math.max(0, this.max - count);
    const oldest = record.timestamps[0] || now;
    const resetMs = Math.max(0, oldest + this.windowMs - now);

    if (count >= this.max) {
      return { allowed: false, remaining: 0, resetMs };
    }

    record.timestamps.push(now);
    return { allowed: true, remaining: remaining - 1, resetMs };
  }

  public async checkAsync(
    ctx: ApexRequestContext
  ): Promise<{ allowed: boolean; remaining: number; resetMs: number }> {
    const globalStateDriver = (globalThis as any).__apex14_state_driver;
    if (globalStateDriver && typeof globalStateDriver.hitRateLimit === "function" && !this.driver) {
      const key = this.keyGenerator(ctx);
      return await globalStateDriver.hitRateLimit(key, this.max, this.windowMs);
    }

    if (this.driver) {
      const key = this.keyGenerator(ctx);
      const res = await this.driver.rateLimitIncrement(key, this.windowMs);
      const remaining = Math.max(0, this.max - res.count);
      return {
        allowed: res.count <= this.max,
        remaining,
        resetMs: res.resetMs
      };
    }

    return this.check(ctx);
  }

  public middleware() {
    return async (ctx: ApexRequestContext, next: () => Promise<any>) => {
      const { allowed, remaining, resetMs } = await this.checkAsync(ctx);

      ctx.header("RateLimit-Limit", String(this.max));
      ctx.header("RateLimit-Remaining", String(remaining));
      ctx.header("RateLimit-Reset", String(Math.ceil(resetMs / 1000)));

      if (!allowed) {
        throw new RateLimitError("Rate limit exceeded", Math.ceil(resetMs / 1000));
      }

      return await next();
    };
  }

  public cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    for (const [key, record] of this.clients.entries()) {
      record.timestamps = record.timestamps.filter((t) => t > windowStart);
      if (record.timestamps.length === 0) {
        this.clients.delete(key);
      }
    }
  }

  public reset(): void {
    this.clients.clear();
  }

  public dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clients.clear();
  }
}

export function rateLimit(options: RateLimitOptions) {
  const limiter = new SlidingWindowRateLimiter(options);
  return limiter.middleware();
}
