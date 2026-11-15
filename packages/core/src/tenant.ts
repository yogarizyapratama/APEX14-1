import { AsyncLocalStorage } from "node:async_hooks";
import { ApexRequestContext } from "@apex14/http";
import type { Middleware } from "./types.js";

export interface TenantConfig {
  header?: string;
  cookie?: string;
  column?: string;
  from?: "header" | "subdomain" | "cookie" | "jwt";
  defaultTenant?: string;
  resolver?: (ctx: ApexRequestContext) => string | undefined | Promise<string | undefined>;
}

const tenantStorage = new AsyncLocalStorage<string>();

export class ApexTenantEngine {
  public config: Required<TenantConfig>;

  constructor() {
    this.config = {
      header: "x-tenant-id",
      cookie: "apex_tenant",
      column: "tenant_id",
      from: "header",
      defaultTenant: "default",
      resolver: (ctx) => {
        // 1. Check header
        const fromHeader = ctx.headers[this.config.header.toLowerCase()];
        if (fromHeader) return fromHeader;

        // 2. Check cookie
        if (this.config.cookie && ctx.cookies[this.config.cookie]) {
          return ctx.cookies[this.config.cookie];
        }

        // 3. Check subdomain
        const host = ctx.headers["host"] || "";
        const parts = host.split(".");
        if (parts.length > 2 && parts[0] && parts[0] !== "www") {
          return parts[0];
        }

        // 4. Check user organization from auth
        if ((ctx as any).user?.tenantId || (ctx as any).user?.orgId) {
          return (ctx as any).user.tenantId || (ctx as any).user.orgId;
        }

        return this.config.defaultTenant;
      }
    };

    // Attach to global hook for @apex14/database ORM models
    (globalThis as any).__apex14_tenant_engine = this;
  }

  public configure(config: TenantConfig): void {
    if (config.header) this.config.header = config.header;
    if (config.cookie) this.config.cookie = config.cookie;
    if (config.column) this.config.column = config.column;
    if (config.from) this.config.from = config.from;
    if (config.defaultTenant !== undefined) this.config.defaultTenant = config.defaultTenant;
    if (config.resolver) this.config.resolver = config.resolver;
  }

  public getCurrentId(ctx?: ApexRequestContext): string | undefined {
    // 1. Check AsyncLocalStorage
    const stored = tenantStorage.getStore();
    if (stored) return stored;

    // 2. Check ctx property
    if (ctx && (ctx as any).tenantId) {
      return (ctx as any).tenantId;
    }

    return this.config.defaultTenant;
  }

  public getColumn(): string {
    return this.config.column;
  }

  public async withTenant<T>(tenantId: string, fn: () => T | Promise<T>): Promise<T> {
    return await tenantStorage.run(tenantId, fn);
  }

  public middleware(): Middleware {
    return async (ctx, next) => {
      let tenantId = await this.config.resolver(ctx);
      if (!tenantId) {
        tenantId = this.config.defaultTenant;
      }
      (ctx as any).tenantId = tenantId;
      return await tenantStorage.run(tenantId, async () => {
        return await next();
      });
    };
  }
}

export const tenant = new ApexTenantEngine();
