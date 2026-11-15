import type { TSchema } from "@sinclair/typebox";
import type { ApexRequestContext } from "@apex14/http";
import { validateOrThrow } from "./validator.js";

export interface RouteValidationSchemas {
  body?: TSchema;
  query?: TSchema;
  params?: TSchema;
  headers?: TSchema;
  response?: TSchema;
}

export function createValidationMiddleware(schemas: RouteValidationSchemas) {
  return async (ctx: ApexRequestContext, next: () => Promise<any>) => {
    if (schemas.params && ctx.params) {
      ctx.params = validateOrThrow(schemas.params, ctx.params, "params") as any;
    }
    if (schemas.query && ctx.query) {
      ctx.query = validateOrThrow(schemas.query, ctx.query, "query") as any;
    }
    const method = ctx.request.method.toUpperCase();
    if (schemas.body !== undefined && method !== "GET" && method !== "HEAD") {
      ctx.body = validateOrThrow(schemas.body, ctx.body, "body");
    }
    const result = await next();
    if (schemas.response && result !== undefined && !(result instanceof Response)) {
      validateOrThrow(schemas.response, result, "response");
    }
    return result;
  };
}
