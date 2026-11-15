export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "OPTIONS"
  | "HEAD"
  | "ALL";

export interface RouteMetadata {
  summary?: string;
  description?: string;
  tags?: string[];
  guard?: string | string[];
  middleware?: any[];
  schema?: any;
  body?: any;
  query?: any;
  params?: any;
  response?: any;
  [key: string]: any;
}

export type RouteHandler<TContext = any, TReturn = any> = (
  ctx: TContext
) => TReturn | Promise<TReturn>;

export interface RouteEntry<TContext = any, TReturn = any> {
  method: HttpMethod;
  path: string;
  handler: RouteHandler<TContext, TReturn>;
  middleware: any[];
  metadata: RouteMetadata;
}

export interface RouteMatchResult<TContext = any, TReturn = any> {
  handler: RouteHandler<TContext, TReturn>;
  params: Record<string, string>;
  middleware: any[];
  metadata: RouteMetadata;
  path: string;
  method: HttpMethod;
}
