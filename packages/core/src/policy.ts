import { AuthorizationError, ApexRequestContext } from "@apex14/http";
import type { Middleware } from "./types.js";

export type PolicyPredicate<TUser = any, TResource = any> = (
  user: TUser,
  resource: TResource,
  ctx?: ApexRequestContext
) => boolean | Promise<boolean>;

export class ApexPolicyEngine {
  private policies = new Map<string, PolicyPredicate>();

  public define<TUser = any, TResource = any>(
    name: string,
    predicate: PolicyPredicate<TUser, TResource>
  ): void {
    this.policies.set(name, predicate);
  }

  public has(name: string): boolean {
    return this.policies.has(name);
  }

  public async allows<TUser = any, TResource = any>(
    user: TUser,
    name: string,
    resource?: TResource,
    ctx?: ApexRequestContext
  ): Promise<boolean> {
    const predicate = this.policies.get(name);
    if (!predicate) {
      throw new AuthorizationError(`Security policy '${name}' is not defined`);
    }

    try {
      const allowed = await predicate(user, resource as TResource, ctx);
      return Boolean(allowed);
    } catch {
      return false;
    }
  }

  public async authorize<TUser = any, TResource = any>(
    user: TUser,
    name: string,
    resource?: TResource,
    ctx?: ApexRequestContext,
    denialMessage?: string
  ): Promise<void> {
    const isAllowed = await this.allows(user, name, resource, ctx);
    if (!isAllowed) {
      throw new AuthorizationError(
        denialMessage || `Access denied by security policy '${name}'`
      );
    }
  }

  public middleware<TResource = any>(
    name: string,
    getResource?: (ctx: ApexRequestContext) => TResource | Promise<TResource>
  ): Middleware {
    return async (ctx: ApexRequestContext, next: () => Promise<any>) => {
      const user = (ctx as any).user;
      let resource: any = undefined;
      if (getResource) {
        resource = await getResource(ctx);
      }
      await this.authorize(user, name, resource, ctx);
      return await next();
    };
  }

  public clear(): void {
    this.policies.clear();
  }
}

export const policy = new ApexPolicyEngine();
