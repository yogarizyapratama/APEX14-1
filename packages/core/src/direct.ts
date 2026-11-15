import { getActiveScope } from "./scope.js";
import type {
  Handler,
  MethodMap,
  Middleware,
  RouteOptions,
  Guard,
  SecurityConfig
} from "./types.js";

export function route(
  path: string,
  handlerOrMethods: Handler | MethodMap,
  options?: RouteOptions
): void {
  getActiveScope().route(path, handlerOrMethods, options);
}

export function group(
  prefix: string,
  callback: () => void,
  options?: RouteOptions
): void {
  getActiveScope().group(prefix, callback, options);
}

export function use(middleware: Middleware): void {
  getActiveScope().use(middleware);
}

export function guard(name: string, guardFn: Guard): void {
  getActiveScope().guard(name, guardFn);
}

export function secure(config: SecurityConfig): void {
  getActiveScope().secure(config);
}

export function inject(name: string, service: any): void {
  getActiveScope().inject(name, service);
}

export function getService<T = any>(name: string): T | undefined {
  return getActiveScope().getService<T>(name);
}

export async function handle(request: Request): Promise<Response> {
  return await getActiveScope().handle(request);
}

export async function testRequest(
  urlOrPath: string,
  init?: RequestInit
): Promise<Response> {
  const url = urlOrPath.startsWith("http")
    ? urlOrPath
    : `http://localhost${urlOrPath.startsWith("/") ? "" : "/"}${urlOrPath}`;
  const req = new Request(url, init);
  return await handle(req);
}
