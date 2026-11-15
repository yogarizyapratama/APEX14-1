import type { ApexRequestContext } from "@apex14/http";
import type { HttpMethod } from "@apex14/router";

export type Middleware = (
  ctx: ApexRequestContext,
  next: () => Promise<any>
) => any | Promise<any>;

export type Handler<TReturn = any> = (
  ctx: ApexRequestContext
) => TReturn | Promise<TReturn>;

export type MethodMap = {
  [K in HttpMethod]?: Handler;
};

export interface RouteOptions {
  summary?: string;
  description?: string;
  tags?: string[];
  guard?: string | string[];
  middleware?: Middleware[];
  body?: any;
  query?: any;
  params?: any;
  response?: any;
  [key: string]: any;
}

export type Guard = (ctx: ApexRequestContext) => boolean | Promise<boolean> | void | Promise<void>;

export interface SecurityConfig {
  jwt?: {
    secret: string;
    expiresIn?: string | number;
    issuer?: string;
    audience?: string;
    algorithms?: string[];
  };
  cors?: {
    origin?: string | string[] | boolean | ((origin: string) => boolean);
    methods?: string[];
    allowedHeaders?: string[];
    exposedHeaders?: string[];
    credentials?: boolean;
    maxAge?: number;
  };
  rateLimit?: {
    max: number;
    windowMs: number;
    keyGenerator?: (ctx: ApexRequestContext) => string;
  };
  headers?: Record<string, string>;
  [key: string]: any;
}
