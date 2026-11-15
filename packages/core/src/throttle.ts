import { ApexRequestContext, RateLimitError } from "@apex14/http";
import type { Handler, Middleware } from "./types.js";

export interface ThrottleTier {
  limit: number;
  window: string | number; // e.g. "1m", "10s", or ms
}

export interface ThrottleConfig {
  tiers?: Record<string, ThrottleTier>;
  defaultTier?: ThrottleTier;
  resolveTier?: (ctx: ApexRequestContext) => string | undefined;
  key?: (ctx: ApexRequestContext) => string;
  cost?: (ctx: ApexRequestContext) => number;
  message?: string;
}

export function parseWindowToMs(window: string | number): number {
  if (typeof window === "number") return window;
  const match = window.trim().match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)?$/i);
  if (!match) return 60000;
  const val = parseFloat(match[1]!);
  const unit = (match[2] || "s").toLowerCase();
  switch (unit) {
    case "ms": return val;
    case "s": return val * 1000;
    case "m": return val * 60 * 1000;
    case "h": return val * 3600 * 1000;
    case "d": return val * 86400 * 1000;
    default: return val * 1000;
  }
}

interface BucketRecord {
  tokens: number;
  lastRefill: number;
  windowStart: number;
  hits: number;
}

export class ApexThrottleInstance {
  private config: Required<ThrottleConfig>;
  private store = new Map<string, BucketRecord>();

  constructor(config: ThrottleConfig = {}) {
    this.config = {
      tiers: config.tiers || {
        free: { limit: 60, window: "1m" },
        pro: { limit: 300, window: "1m" },
        enterprise: { limit: 1200, window: "1m" }
      },
      defaultTier: config.defaultTier || { limit: 60, window: "1m" },
      resolveTier: config.resolveTier || ((ctx) => (ctx as any).user?.tier || (ctx as any).user?.plan || "free"),
      key: config.key || ((ctx) => (ctx as any).user?.id || ctx.ip || "anon"),
      cost: config.cost || (() => 1),
      message: config.message || "Too many requests. Rate limit exceeded."
    };
  }

  public middleware(): Middleware {
    return async (ctx: ApexRequestContext, next: () => Promise<any>) => {
      const tierName = this.config.resolveTier(ctx) || "free";
      const tier = this.config.tiers[tierName] || this.config.defaultTier;
      const windowMs = parseWindowToMs(tier.window);
      const limit = tier.limit;
      const cost = Math.max(1, this.config.cost(ctx));
      const clientKey = `${tierName}:${this.config.key(ctx)}`;

      const now = Date.now();
      let record = this.store.get(clientKey);

      if (!record || now - record.windowStart >= windowMs) {
        record = {
          tokens: limit - cost,
          lastRefill: now,
          windowStart: now,
          hits: cost
        };
        this.store.set(clientKey, record);
      } else {
        if (record.hits + cost > limit) {
          const resetSeconds = Math.ceil((record.windowStart + windowMs - now) / 1000);
          ctx.responseHeaders.set("retry-after", String(resetSeconds));
          ctx.responseHeaders.set("x-ratelimit-limit", String(limit));
          ctx.responseHeaders.set("x-ratelimit-remaining", "0");
          ctx.responseHeaders.set("x-ratelimit-reset", String(resetSeconds));
          throw new RateLimitError(this.config.message);
        }
        record.hits += cost;
        record.tokens = Math.max(0, limit - record.hits);
      }

      const remaining = Math.max(0, limit - record.hits);
      const resetSec = Math.ceil((record.windowStart + windowMs - now) / 1000);
      ctx.responseHeaders.set("x-ratelimit-limit", String(limit));
      ctx.responseHeaders.set("x-ratelimit-remaining", String(remaining));
      ctx.responseHeaders.set("x-ratelimit-reset", String(resetSec));

      return await next();
    };
  }

  public wrap(handler: Handler): Handler {
    const mw = this.middleware();
    return async (ctx: ApexRequestContext) => {
      return await mw(ctx, async () => await handler(ctx));
    };
  }

  public clear(): void {
    this.store.clear();
  }
}

export function throttle(config: ThrottleConfig = {}): ApexThrottleInstance & Middleware {
  const instance = new ApexThrottleInstance(config);
  const mw = instance.middleware();
  const fn = mw as any;
  fn.wrap = (handler: Handler) => instance.wrap(handler);
  fn.clear = () => instance.clear();
  fn.middleware = () => mw;
  return fn;
}
