export interface ClientOptions {
  headers?: Record<string, string> | (() => Record<string, string> | Promise<Record<string, string>>);
  fetch?: typeof fetch;
}

export interface RequestOptions {
  body?: any;
  query?: Record<string, any>;
  headers?: Record<string, string>;
  params?: Record<string, string>;
}

export interface RouteEndpoint<TResponse = any, TBody = any, TQuery = any> {
  response: TResponse;
  body?: TBody;
  query?: TQuery;
}

export type InferRouteResponse<TRoute> = TRoute extends { response: infer R }
  ? R
  : TRoute extends (...args: any[]) => infer R
    ? Awaited<R>
    : any;

export type InferRouteBody<TRoute> = TRoute extends { body: infer B }
  ? B
  : any;

export type InferRouteQuery<TRoute> = TRoute extends { query: infer Q }
  ? Q
  : Record<string, any>;

export type ApexRoutesDefinition = Record<string, any>;

export type ClientMethod<TEndpoint> = (
  options?: RequestOptions & {
    body?: InferRouteBody<TEndpoint>;
    query?: InferRouteQuery<TEndpoint>;
  }
) => Promise<InferRouteResponse<TEndpoint>>;

export type TypedClient<TRoutes> = [TRoutes] extends [never]
  ? ClientProxy
  : [TRoutes] extends [any]
    ? TRoutes extends Record<string, any>
      ? {
          [K in keyof TRoutes]: TRoutes[K] extends RouteEndpoint<any, any, any>
            ? ClientMethod<TRoutes[K]>
            : TRoutes[K] extends Record<string, any>
              ? TypedClient<TRoutes[K]> & ((param: string | number) => TypedClient<TRoutes[K]>)
              : any;
        } & ClientProxy
      : ClientProxy
    : ClientProxy;

export class ApexClientError extends Error {
  constructor(
    public status: number,
    public data: any,
    message?: string
  ) {
    super(message || (typeof data === "object" && data?.error?.message ? data.error.message : `Request failed with status ${status}`));
    this.name = "ApexClientError";
  }
}

export type HttpMethod = "get" | "post" | "put" | "patch" | "delete" | "head" | "options";

export type ClientProxy = {
  [key: string]: any;
};

export function createApexClient<TRoutes = any>(
  baseUrl: string,
  options: ClientOptions = {}
): TypedClient<TRoutes> {
  const fetchFn = options.fetch || globalThis.fetch;
  const cleanBase = baseUrl.replace(/\/+$/, "");

  function buildProxy(pathSegments: string[]): any {
    const target = function (...args: any[]) {
      // If called with arguments like client.users(123)
      if (args.length > 0 && typeof args[0] !== "object") {
        return buildProxy([...pathSegments, String(args[0])]);
      }
      return buildProxy(pathSegments);
    };

    return new Proxy(target, {
      get(_target, prop: string) {
        const method = prop.toLowerCase();
        if (["get", "post", "put", "patch", "delete", "head", "options"].includes(method)) {
          return async (reqOpts: RequestOptions = {}) => {
            const path = "/" + pathSegments.join("/");
            let url = cleanBase + path;

            // Append query parameters
            if (reqOpts.query && Object.keys(reqOpts.query).length > 0) {
              const qs = new URLSearchParams();
              for (const [k, v] of Object.entries(reqOpts.query)) {
                if (v !== undefined && v !== null) {
                  qs.append(k, String(v));
                }
              }
              url += (url.includes("?") ? "&" : "?") + qs.toString();
            }

            // Resolve headers
            const baseHeaders = typeof options.headers === "function"
              ? await options.headers()
              : (options.headers || {});

            const headers = new Headers({
              "content-type": "application/json",
              ...baseHeaders,
              ...(reqOpts.headers || {})
            });

            const hasBody = ["post", "put", "patch"].includes(method) && reqOpts.body !== undefined;
            const res = await fetchFn(url, {
              method: method.toUpperCase(),
              headers,
              body: hasBody ? JSON.stringify(reqOpts.body) : undefined
            });

            const contentType = res.headers.get("content-type") || "";
            let data: any;
            if (contentType.includes("application/json")) {
              data = await res.json();
            } else {
              data = await res.text();
            }

            if (!res.ok) {
              throw new ApexClientError(res.status, data);
            }

            return data;
          };
        }

        return buildProxy([...pathSegments, prop]);
      }
    });
  }

  return buildProxy([]) as any as TypedClient<TRoutes>;
}
