import { AsyncLocalStorage } from "node:async_hooks";
import { RadixRouter, type HttpMethod } from "@apex14/router";
import {
  ApexRequestContext,
  ApexSseResult,
  NotFoundError,
  AuthorizationError,
  parseRequestBody,
  serializeResponse,
  serializeErrorResponse
} from "@apex14/http";
import { createValidationMiddleware } from "@apex14/validation";
import type {
  Handler,
  MethodMap,
  Middleware,
  RouteOptions,
  Guard,
  SecurityConfig,
  WebSocketHandlers,
  TaskOptions,
  TaskDispatcher,
  ScheduleOptions,
  ScheduledJob
} from "./types.js";
import {
  generateOpenApiSpec,
  renderDocsHtml,
  createMcpHandler,
  type RouteManifestEntry
} from "./openapi.js";
import { TaskQueue, TaskScheduler } from "./tasks.js";

interface GroupContext {
  prefix: string;
  middleware: Middleware[];
  guards: string[];
}

export class ApexScope {
  public router = new RadixRouter();
  public globalMiddleware: Middleware[] = [];
  public guards = new Map<string, Guard>();
  public securityConfig: SecurityConfig = {};
  public services = new Map<string, any>();
  public routesManifest: RouteManifestEntry[] = [];
  public wsRoutes = new Map<string, WebSocketHandlers>();
  public taskQueues = new Map<string, TaskQueue>();
  public scheduler = new TaskScheduler();
  private groupStack: GroupContext[] = [];

  public route(
    path: string,
    handlerOrMethods: Handler | MethodMap,
    options: RouteOptions = {}
  ): void {
    const currentPrefix = this.groupStack.map((g) => g.prefix).join("");
    const fullPath = this.combinePaths(currentPrefix, path);

    // Auto-create validation middleware if schemas are provided
    const validationMiddleware: Middleware[] = [];
    if (options.body || options.query || options.params || options.response) {
      validationMiddleware.push(
        createValidationMiddleware({
          body: options.body,
          query: options.query,
          params: options.params,
          response: options.response
        })
      );
    }

    // Merge group middleware and route middleware
    const groupMiddleware = this.groupStack.flatMap((g) => g.middleware);
    const routeMiddleware = options.middleware || [];
    const allMiddleware = [...groupMiddleware, ...validationMiddleware, ...routeMiddleware];

    // Merge group guards and route guards
    const groupGuards = this.groupStack.flatMap((g) => g.guards);
    const routeGuards = options.guard
      ? Array.isArray(options.guard)
        ? options.guard
        : [options.guard]
      : [];
    const allGuards = [...groupGuards, ...routeGuards];

    const metadata: RouteOptions = {
      ...options,
      guard: allGuards
    };

    if (typeof handlerOrMethods === "function") {
      const defaultMethod = options.method || (options.body ? "POST" : "GET");
      const methodUpper = defaultMethod.toUpperCase() as HttpMethod;
      this.routesManifest.push({
        path: fullPath,
        method: methodUpper,
        handler: handlerOrMethods,
        options: metadata
      });
      this.router.add({
        method: methodUpper,
        path: fullPath,
        handler: handlerOrMethods,
        middleware: allMiddleware,
        metadata
      });
    } else {
      for (const [method, handler] of Object.entries(handlerOrMethods)) {
        if (typeof handler === "function") {
          const methodUpper = method.toUpperCase() as HttpMethod;
          this.routesManifest.push({
            path: fullPath,
            method: methodUpper,
            handler,
            options: metadata
          });
          this.router.add({
            method: methodUpper,
            path: fullPath,
            handler,
            middleware: allMiddleware,
            metadata
          });
        }
      }
    }
  }

  public sse(
    path: string,
    generatorFn: (ctx: ApexRequestContext) => AsyncIterable<any>,
    options: RouteOptions = {}
  ): void {
    this.route(path, {
      GET: async (ctx) => {
        const stream = generatorFn(ctx);
        return new ApexSseResult(stream);
      }
    }, options);
  }

  public ws(path: string, handlers: WebSocketHandlers): void {
    const currentPrefix = this.groupStack.map((g) => g.prefix).join("");
    const fullPath = this.combinePaths(currentPrefix, path);
    this.wsRoutes.set(fullPath, handlers);
  }

  public task<TData = any, TResult = any>(
    name: string,
    handler: (data: TData) => Promise<TResult>,
    options?: TaskOptions
  ): TaskDispatcher<TData, TResult> {
    let queue = this.taskQueues.get(name);
    if (!queue) {
      queue = new TaskQueue<TData, TResult>(name, handler, options);
      this.taskQueues.set(name, queue);
    }
    return queue;
  }

  public schedule(
    patternOrOptions: string | ScheduleOptions,
    handler: () => void | Promise<void>
  ): ScheduledJob {
    return this.scheduler.schedule(patternOrOptions, handler);
  }

  public getOpenApiSpec(info?: { title?: string; version?: string; description?: string }): Record<string, any> {
    return generateOpenApiSpec(this.routesManifest, info);
  }

  public exportMcpTools(): MethodMap {
    const handler = createMcpHandler(this);
    return {
      GET: handler,
      POST: handler
    };
  }

  public enableDocs(options: { docsPath?: string; specPath?: string; title?: string } = {}): void {
    const docsPath = options.docsPath || "/_docs";
    const specPath = options.specPath || "/_openapi.json";
    const title = options.title || "APEX14 API Reference";

    this.route(specPath, {
      GET: () => this.getOpenApiSpec({ title })
    });

    this.route(docsPath, {
      GET: (ctx) => {
        ctx.responseHeaders.set("content-type", "text/html; charset=utf-8");
        return renderDocsHtml(specPath, title);
      }
    });
  }

  public group(prefix: string, callback: () => void, options: RouteOptions = {}): void {
    const guards = options.guard
      ? Array.isArray(options.guard)
        ? options.guard
        : [options.guard]
      : [];
    const middleware = options.middleware || [];

    this.groupStack.push({
      prefix: this.normalizePrefix(prefix),
      middleware,
      guards
    });

    try {
      callback();
    } finally {
      this.groupStack.pop();
    }
  }

  public use(middleware: Middleware): void {
    this.globalMiddleware.push(middleware);
  }

  public guard(name: string, guardFn: Guard): void {
    this.guards.set(name, guardFn);
  }

  public secure(config: SecurityConfig): void {
    this.securityConfig = { ...this.securityConfig, ...config };
  }

  public inject(name: string, service: any): void {
    this.services.set(name, service);
  }

  public getService<T = any>(name: string): T | undefined {
    return this.services.get(name);
  }

  public async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    // CORS preflight handling if CORS is configured
    if (method === "OPTIONS" && this.securityConfig.cors) {
      return this.handleCorsPreflight(request);
    }

    const match = this.router.match(method, url.pathname);
    if (!match) {
      const errRes = serializeErrorResponse(new NotFoundError(`Cannot ${method} ${url.pathname}`));
      return this.applyCors(errRes, request);
    }

    const servicesObj: Record<string, any> = {};
    for (const [k, v] of this.services.entries()) {
      servicesObj[k] = v;
    }

    const ctx = new ApexRequestContext({
      request,
      params: match.params,
      services: servicesObj
    });

    try {
      // 1. Parse body if applicable
      const { body, files } = await parseRequestBody(request);
      ctx.body = body;
      ctx.files = files;

      // 2. Validate guards
      const routeGuards: string[] = Array.isArray(match.metadata.guard)
        ? match.metadata.guard
        : match.metadata.guard
          ? [match.metadata.guard]
          : [];

      for (const guardName of routeGuards) {
        const guardFn = this.guards.get(guardName);
        if (!guardFn) {
          throw new AuthorizationError(`Guard '${guardName}' is not registered`);
        }
        const ok = await guardFn(ctx);
        if (ok === false) {
          throw new AuthorizationError(`Access denied by guard '${guardName}'`);
        }
      }

      // 3. Compose middleware pipeline
      // Pipeline: globalMiddleware -> routeMiddleware -> handler
      const chain: Middleware[] = [...this.globalMiddleware, ...match.middleware];

      let idx = 0;
      const next = async (): Promise<any> => {
        if (idx < chain.length) {
          const mw = chain[idx++]!;
          return await mw(ctx, next);
        }
        return await match.handler(ctx);
      };

      const result = await next();
      const res = serializeResponse(result, ctx);
      return this.applyCors(res, request);
    } catch (err: any) {
      const errRes = serializeErrorResponse(err);
      return this.applyCors(errRes, request);
    }
  }

  private handleCorsPreflight(request: Request): Response {
    const cors = this.securityConfig.cors || {};
    const origin = request.headers.get("origin") || "*";
    const headers = new Headers();

    headers.set("access-control-allow-origin", origin);
    headers.set(
      "access-control-allow-methods",
      cors.methods ? cors.methods.join(", ") : "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    );
    headers.set(
      "access-control-allow-headers",
      cors.allowedHeaders
        ? cors.allowedHeaders.join(", ")
        : request.headers.get("access-control-request-headers") || "*"
    );
    if (cors.credentials) {
      headers.set("access-control-allow-credentials", "true");
    }
    if (cors.maxAge) {
      headers.set("access-control-max-age", String(cors.maxAge));
    }

    return new Response(null, { status: 204, headers });
  }

  private applyCors(res: Response, request: Request): Response {
    if (!this.securityConfig.cors) return res;
    const origin = request.headers.get("origin");
    if (!origin) return res;

    const cors = this.securityConfig.cors;
    const headers = new Headers(res.headers);
    headers.set("access-control-allow-origin", origin);
    if (cors.credentials) {
      headers.set("access-control-allow-credentials", "true");
    }
    if (cors.exposedHeaders) {
      headers.set("access-control-expose-headers", cors.exposedHeaders.join(", "));
    }

    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers
    });
  }

  private normalizePrefix(prefix: string): string {
    let clean = prefix.trim();
    if (!clean.startsWith("/")) clean = "/" + clean;
    if (clean.endsWith("/")) clean = clean.slice(0, -1);
    return clean;
  }

  private combinePaths(a: string, b: string): string {
    let cleanA = a.trim();
    let cleanB = b.trim();
    if (cleanA.endsWith("/")) cleanA = cleanA.slice(0, -1);
    if (!cleanB.startsWith("/")) cleanB = "/" + cleanB;
    const combined = cleanA + cleanB;
    return combined === "" ? "/" : combined;
  }
}

const scopeStorage = new AsyncLocalStorage<ApexScope>();
export const defaultGlobalScope = new ApexScope();

export function getActiveScope(): ApexScope {
  return scopeStorage.getStore() || defaultGlobalScope;
}

export function createScope(): ApexScope {
  return new ApexScope();
}

export function withScope<T>(scope: ApexScope, fn: () => T): T {
  return scopeStorage.run(scope, fn);
}
