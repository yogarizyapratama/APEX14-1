import type { ApexRequestContext } from "@apex14/http";

export interface SecurityHeadersOptions {
  contentSecurityPolicy?: string | false;
  hsts?: { maxAge?: number; includeSubDomains?: boolean; preload?: boolean } | boolean;
  frameOptions?: "DENY" | "SAMEORIGIN" | false;
  contentTypeOptions?: boolean;
  referrerPolicy?: string;
}

export function securityHeaders(options: SecurityHeadersOptions = {}) {
  const hsts = options.hsts !== false;
  const frame = options.frameOptions !== false ? options.frameOptions || "DENY" : false;
  const nosniff = options.contentTypeOptions !== false;
  const referrer = options.referrerPolicy || "strict-origin-when-cross-origin";
  const csp = options.contentSecurityPolicy !== false
    ? options.contentSecurityPolicy || "default-src 'self'; base-uri 'self'; object-src 'none';"
    : false;

  return async (ctx: ApexRequestContext, next: () => Promise<any>) => {
    if (nosniff) {
      ctx.header("x-content-type-options", "nosniff");
    }
    if (frame) {
      ctx.header("x-frame-options", frame);
    }
    if (hsts) {
      const maxAge = typeof options.hsts === "object" && options.hsts.maxAge ? options.hsts.maxAge : 31536000;
      const subDomains = typeof options.hsts === "object" && options.hsts.includeSubDomains !== false;
      const preload = typeof options.hsts === "object" && options.hsts.preload;
      let val = `max-age=${maxAge}`;
      if (subDomains) val += "; includeSubDomains";
      if (preload) val += "; preload";
      ctx.header("strict-transport-security", val);
    }
    if (referrer) {
      ctx.header("referrer-policy", referrer);
    }
    if (csp) {
      ctx.header("content-security-policy", csp);
    }

    return await next();
  };
}

export interface CorsOptions {
  origin?: string | string[] | boolean | ((origin: string) => boolean);
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}

export function cors(options: CorsOptions = {}) {
  const allowedMethods = options.methods || ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];
  const allowedHeaders = options.allowedHeaders || ["content-type", "authorization", "x-requested-with"];

  return async (ctx: ApexRequestContext, next: () => Promise<any>) => {
    const origin = ctx.headers["origin"];

    if (origin) {
      let isAllowed = false;

      if (options.origin === undefined || options.origin === true) {
        isAllowed = true;
      } else if (typeof options.origin === "string") {
        isAllowed = options.origin === "*" || options.origin === origin;
      } else if (Array.isArray(options.origin)) {
        isAllowed = options.origin.includes(origin);
      } else if (typeof options.origin === "function") {
        isAllowed = options.origin(origin);
      }

      if (isAllowed) {
        if (options.credentials && (options.origin === "*" || !options.origin)) {
          // Rule: Never allow wildcard '*' with credentials!
          ctx.header("access-control-allow-origin", origin);
        } else {
          ctx.header("access-control-allow-origin", typeof options.origin === "string" ? options.origin : origin);
        }

        if (options.credentials) {
          ctx.header("access-control-allow-credentials", "true");
        }
        if (options.exposedHeaders && options.exposedHeaders.length > 0) {
          ctx.header("access-control-expose-headers", options.exposedHeaders.join(", "));
        }
      }
    }

    if (ctx.request.method.toUpperCase() === "OPTIONS") {
      ctx.header("access-control-allow-methods", allowedMethods.join(", "));
      ctx.header("access-control-allow-headers", allowedHeaders.join(", "));
      if (options.maxAge) {
        ctx.header("access-control-max-age", String(options.maxAge));
      }
      return ctx.status(204);
    }

    return await next();
  };
}
