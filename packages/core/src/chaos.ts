import { ApexError } from "@apex14/http";
import type { Middleware } from "./types.js";

export interface ChaosConfig {
  routes?: string[];
  latencyMs?: { min: number; max: number } | number;
  failureRate?: number;
  errorStatus?: number;
  errorMessage?: string;
  enableWhen?: () => boolean;
}

export class ApexChaosEngine {
  private activeConfig?: ChaosConfig;

  public inject(config: ChaosConfig): void {
    this.activeConfig = config;
  }

  public reset(): void {
    this.activeConfig = undefined;
  }

  public isEnabled(): boolean {
    if (!this.activeConfig) return false;
    if (this.activeConfig.enableWhen && !this.activeConfig.enableWhen()) {
      return false;
    }
    return true;
  }

  public middleware(): Middleware {
    return async (ctx, next) => {
      if (!this.isEnabled() || !this.activeConfig) {
        return await next();
      }

      const pathname = ctx.url.pathname;
      const matched = this.matchRoute(pathname, this.activeConfig.routes);
      if (!matched) {
        return await next();
      }

      // 1. Inject Artificial Latency
      if (this.activeConfig.latencyMs) {
        let delay = 0;
        if (typeof this.activeConfig.latencyMs === "number") {
          delay = this.activeConfig.latencyMs;
        } else {
          const { min, max } = this.activeConfig.latencyMs;
          delay = Math.floor(Math.random() * (max - min + 1)) + min;
        }
        if (delay > 0) {
          await new Promise((r) => setTimeout(r, delay));
        }
      }

      // 2. Inject Controlled Failure Rate
      if (this.activeConfig.failureRate && this.activeConfig.failureRate > 0) {
        if (Math.random() < this.activeConfig.failureRate) {
          const status = this.activeConfig.errorStatus || 503;
          const msg = this.activeConfig.errorMessage || "Chaos Simulation: Service Unavailable";
          throw new ApexError(status, msg, "CHAOS_FAULT");
        }
      }

      return await next();
    };
  }

  private matchRoute(pathname: string, patterns?: string[]): boolean {
    if (!patterns || patterns.length === 0) return true;
    for (const pat of patterns) {
      if (pat.endsWith("/*")) {
        const prefix = pat.slice(0, -2);
        if (pathname.startsWith(prefix)) return true;
      } else if (pat === pathname) {
        return true;
      }
    }
    return false;
  }
}

export const chaos = new ApexChaosEngine();
