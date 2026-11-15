import type { CookieOptions } from "./cookies.js";
import { parseCookies, serializeCookie } from "./cookies.js";

export interface ContextOptions {
  request: Request;
  params?: Record<string, string>;
  ip?: string;
  state?: Record<string, any>;
  services?: Record<string, any>;
}

export class ApexRedirect {
  constructor(public url: string, public status: number = 302) {}
}

export class ApexFileResult {
  constructor(
    public data: Uint8Array | ReadableStream,
    public filename: string,
    public contentType: string = "application/octet-stream",
    public status: number = 200
  ) {}
}

export interface SseMessage {
  event?: string;
  data: any;
  id?: string;
  retry?: number;
}

export class ApexSseResult {
  constructor(
    public stream: AsyncIterable<SseMessage | string | any>,
    public options: { headers?: Headers | Record<string, string> | string[][]; status?: number } = {}
  ) {}
}

export class ApexRequestContext<TBody = any, TParams = Record<string, string>, TQuery = Record<string, any>> {
  public request: Request;
  public params: TParams;
  public query: TQuery;
  public headers: Record<string, string>;
  public cookies: Record<string, string>;
  public body: TBody = undefined as any;
  public files: Record<string, any> = {};
  public user: any = null;
  public session: any = null;
  public ip: string;
  public url: URL;
  public signal: AbortSignal;
  public state: Record<string, any>;
  public services: Record<string, any>;

  // Response modifications tracked during handler/middleware execution
  public responseStatus: number = 200;
  public responseHeaders: Headers = new Headers();
  private pendingCookies: string[] = [];

  constructor(options: ContextOptions) {
    this.request = options.request;
    this.params = (options.params || {}) as TParams;
    this.url = new URL(options.request.url);
    this.signal = options.request.signal;
    this.ip = options.ip || options.request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    this.state = options.state || {};
    this.services = options.services || {};

    // Extract headers as a lowercased dictionary
    const h: Record<string, string> = {};
    options.request.headers.forEach((v, k) => {
      h[k.toLowerCase()] = v;
    });
    this.headers = h;

    // Parse query params
    const q: Record<string, any> = {};
    this.url.searchParams.forEach((v, k) => {
      if (q[k] !== undefined) {
        if (Array.isArray(q[k])) {
          q[k].push(v);
        } else {
          q[k] = [q[k], v];
        }
      } else {
        q[k] = v;
      }
    });
    this.query = q as TQuery;

    // Parse cookies
    this.cookies = parseCookies(options.request.headers.get("cookie"));
  }

  public status(code: number): this {
    this.responseStatus = code;
    return this;
  }

  public header(name: string, value: string): this {
    this.responseHeaders.set(name, value);
    return this;
  }

  public cookie(name: string, value: string, options: CookieOptions = {}): this {
    const serialized = serializeCookie(name, value, options);
    this.pendingCookies.push(serialized);
    return this;
  }

  public getSetCookieHeaders(): string[] {
    return [...this.pendingCookies];
  }

  public redirect(url: string, status: number = 302): ApexRedirect {
    return new ApexRedirect(url, status);
  }

  public env(key: string, defaultValue?: any): any {
    if (typeof process !== "undefined" && process.env) {
      return process.env[key] !== undefined ? process.env[key] : defaultValue;
    }
    return defaultValue;
  }
}
