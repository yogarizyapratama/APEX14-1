import { ApexRequestContext } from "@apex14/http";
import type { Handler } from "./types.js";

export interface FeatureFlagConfig {
  enabled?: boolean;
  percentage?: number; // 0.0 - 1.0 (e.g. 0.25 = 25% rollout)
  enabledForUsers?: string[];
  enabledForTenants?: string[];
  rule?: (ctx: ApexRequestContext) => boolean | Promise<boolean>;
}

// 32-bit FNV-1a hash algorithm for deterministic sticky percentage calculation
function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export class ApexFeatureEngine {
  private flags = new Map<string, FeatureFlagConfig>();

  public define(name: string, config: FeatureFlagConfig): void {
    this.flags.set(name, config);
  }

  public isEnabled(
    name: string,
    targetOrContext?: ApexRequestContext | string | { userId?: string; tenantId?: string }
  ): boolean {
    const config = this.flags.get(name);
    if (!config) return false;

    // Master killswitch
    if (config.enabled === false) return false;

    let userId: string | undefined;
    let tenantId: string | undefined;

    if (typeof targetOrContext === "string") {
      userId = targetOrContext;
    } else if (targetOrContext && "request" in targetOrContext) {
      // ApexRequestContext
      const ctx = targetOrContext as ApexRequestContext;
      userId = (ctx as any).user?.id || ctx.headers["x-user-id"] || ctx.ip;
      tenantId = (ctx as any).tenantId || ctx.headers["x-tenant-id"];
    } else if (targetOrContext && typeof targetOrContext === "object") {
      userId = (targetOrContext as any).userId;
      tenantId = (targetOrContext as any).tenantId;
    }

    // Specific user targeting
    if (userId && config.enabledForUsers && config.enabledForUsers.includes(userId)) {
      return true;
    }

    // Specific tenant targeting
    if (tenantId && config.enabledForTenants && config.enabledForTenants.includes(tenantId)) {
      return true;
    }

    // Percentage rollout evaluation using sticky hashing
    if (config.percentage !== undefined) {
      if (config.percentage <= 0) return false;
      if (config.percentage >= 1.0) return true;

      const hashSeed = `${name}:${userId || tenantId || "anonymous"}`;
      const hashVal = fnv1a(hashSeed);
      const ratio = (hashVal % 10000) / 10000;
      return ratio < config.percentage;
    }

    return config.enabled ?? true;
  }

  public gate(
    name: string,
    activeHandler: Handler,
    fallbackHandler: Handler = () => ({ status: "feature_disabled", message: `Feature '${name}' is not enabled` })
  ): Handler {
    return async (ctx: ApexRequestContext) => {
      const active = this.isEnabled(name, ctx);
      if (active) {
        return await activeHandler(ctx);
      }
      return await fallbackHandler(ctx);
    };
  }

  public all(): Record<string, FeatureFlagConfig> {
    return Object.fromEntries(this.flags.entries());
  }

  public clear(): void {
    this.flags.clear();
  }
}

export const feature = new ApexFeatureEngine();
