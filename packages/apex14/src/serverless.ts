import { getActiveScope, type ApexScope } from "@apex14/core";

export interface CreateFetchHandlerOptions {
  basePath?: string;
  scope?: ApexScope;
}

export type FetchHandlerFn = (request: Request, context?: any) => Promise<Response>;

export interface ServerlessFetchHandlers {
  GET: FetchHandlerFn;
  POST: FetchHandlerFn;
  PUT: FetchHandlerFn;
  PATCH: FetchHandlerFn;
  DELETE: FetchHandlerFn;
  OPTIONS: FetchHandlerFn;
  HEAD: FetchHandlerFn;
  handle: FetchHandlerFn;
}

export function createFetchHandler(
  options: CreateFetchHandlerOptions = {}
): ServerlessFetchHandlers {
  const basePath = options.basePath ? options.basePath.replace(/\/+$/, "") : "";
  const targetScope = options.scope || getActiveScope();

  const dispatch: FetchHandlerFn = async (request: Request): Promise<Response> => {
    let dispatchReq = request;

    if (basePath) {
      const url = new URL(request.url);
      if (url.pathname.startsWith(basePath)) {
        let stripped = url.pathname.slice(basePath.length);
        if (!stripped.startsWith("/")) {
          stripped = "/" + stripped;
        }

        const newUrl = `${url.origin}${stripped}${url.search}`;
        dispatchReq = new Request(newUrl, {
          method: request.method,
          headers: request.headers,
          body: request.body,
          // @ts-ignore duplex is needed for streaming body in Node
          duplex: request.body ? "half" : undefined
        });
      }
    }

    return await targetScope.handle(dispatchReq);
  };

  return {
    GET: dispatch,
    POST: dispatch,
    PUT: dispatch,
    PATCH: dispatch,
    DELETE: dispatch,
    OPTIONS: dispatch,
    HEAD: dispatch,
    handle: dispatch
  };
}
