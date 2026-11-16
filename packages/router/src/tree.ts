import type { HttpMethod, RouteEntry, RouteMatchResult } from "./types.js";

interface InternalRouteEntry extends RouteEntry {
  paramNames: string[];
  wildcardName?: string;
}

interface Node {
  part: string;
  isParam: boolean;
  isWildcard: boolean;
  staticChildren: Map<string, Node>;
  paramChild: Node | null;
  wildcardChild: Node | null;
  handlers: Map<HttpMethod, InternalRouteEntry>;
}

function createNode(
  part: string = "",
  isParam = false,
  isWildcard = false
): Node {
  return {
    part,
    isParam,
    isWildcard,
    staticChildren: new Map(),
    paramChild: null,
    wildcardChild: null,
    handlers: new Map()
  };
}

const EMPTY_PARAMS: Record<string, string> = Object.freeze({});

export class RadixRouter {
  private root: Node = createNode();
  private entries: RouteEntry[] = [];
  // Hyper-speed direct O(1) table for static paths
  private staticRouteTable = new Map<string, Map<HttpMethod, RouteEntry>>();
  // Pre-allocated capture buffer for hot-path parameter extraction
  private captureBuffer: string[] = new Array(16);

  public add(entry: RouteEntry): void {
    this.entries.push(entry);

    const path = entry.path;
    let start = 0;
    let end = path.length;

    // Strip leading & trailing '/' using char-code 47 ('/')
    while (start < end && path.charCodeAt(start) === 47) start++;
    while (end > start && path.charCodeAt(end - 1) === 47) end--;

    const cleanPath = start >= end ? "/" : "/" + path.substring(start, end);

    const paramNames: string[] = [];
    let wildcardName: string | undefined;

    let current = this.root;

    if (start >= end) {
      // Root route "/"
      const internalEntry: InternalRouteEntry = { ...entry, paramNames: [] };
      current.handlers.set(entry.method, internalEntry);

      let methodMap = this.staticRouteTable.get("/");
      if (!methodMap) {
        methodMap = new Map();
        this.staticRouteTable.set("/", methodMap);
      }
      methodMap.set(entry.method, entry);
      return;
    }

    while (start < end) {
      let nextSlash = start;
      while (nextSlash < end && path.charCodeAt(nextSlash) !== 47) {
        nextSlash++;
      }

      const seg = path.substring(start, nextSlash);
      const isParam = seg.charCodeAt(0) === 58; // ':'
      const isWildcard = seg.charCodeAt(0) === 42; // '*'

      if (isWildcard) {
        wildcardName = seg.length > 1 ? seg.slice(1) : "wildcard";
        if (!current.wildcardChild) {
          current.wildcardChild = createNode(seg, false, true);
        }
        current = current.wildcardChild;
        break; // Wildcard consumes the rest of the path
      } else if (isParam) {
        paramNames.push(seg.slice(1));
        if (!current.paramChild) {
          current.paramChild = createNode(seg, true, false);
        }
        current = current.paramChild;
      } else {
        let child = current.staticChildren.get(seg);
        if (!child) {
          child = createNode(seg);
          current.staticChildren.set(seg, child);
        }
        current = child;
      }

      start = nextSlash + 1;
      while (start < end && path.charCodeAt(start) === 47) start++;
    }

    const internalEntry: InternalRouteEntry = {
      ...entry,
      paramNames,
      wildcardName
    };

    current.handlers.set(entry.method, internalEntry);

    // If completely static, register in O(1) static lookup table
    if (paramNames.length === 0 && !wildcardName) {
      let methodMap = this.staticRouteTable.get(cleanPath);
      if (!methodMap) {
        methodMap = new Map();
        this.staticRouteTable.set(cleanPath, methodMap);
      }
      methodMap.set(entry.method, entry);
    }
  }

  public match(method: string, path: string): RouteMatchResult | null {
    const httpMethod = method.toUpperCase() as HttpMethod;

    // 1. HYPER HOT-PATH: Direct O(1) static route table lookup (0 nanosecond allocation)
    const directHit = this.staticRouteTable.get(path);
    if (directHit) {
      const entry = directHit.get(httpMethod) || (directHit.has("ALL") ? directHit.get("ALL") : undefined);
      if (entry) {
        return {
          handler: entry.handler,
          params: EMPTY_PARAMS,
          middleware: entry.middleware,
          metadata: entry.metadata,
          path: entry.path,
          method: entry.method
        };
      }
    }

    let start = 0;
    let end = path.length;

    // Zero-allocation strip leading & trailing '/' using char-code 47
    while (start < end && path.charCodeAt(start) === 47) start++;
    while (end > start && path.charCodeAt(end - 1) === 47) end--;

    // Fast-path for Root path "/"
    if (start >= end) {
      const rootHit = this.staticRouteTable.get("/");
      if (rootHit) {
        const entry = rootHit.get(httpMethod) || (rootHit.has("ALL") ? rootHit.get("ALL") : undefined);
        if (entry) {
          return {
            handler: entry.handler,
            params: EMPTY_PARAMS,
            middleware: entry.middleware,
            metadata: entry.metadata,
            path: entry.path,
            method: entry.method
          };
        }
      }
      return null;
    }

    // Normalized static check (e.g. if path was "/health/" or "health")
    const normalizedKey = "/" + path.substring(start, end);
    if (normalizedKey !== path) {
      const normHit = this.staticRouteTable.get(normalizedKey);
      if (normHit) {
        const entry = normHit.get(httpMethod) || (normHit.has("ALL") ? normHit.get("ALL") : undefined);
        if (entry) {
          return {
            handler: entry.handler,
            params: EMPTY_PARAMS,
            middleware: entry.middleware,
            metadata: entry.metadata,
            path: entry.path,
            method: entry.method
          };
        }
      }
    }

    // 2. DYNAMIC / PARAMETERIZED RADIX MATCHING
    const buffer = this.captureBuffer;
    const matched = this.matchDynamic(this.root, path, start, end, buffer, 0);
    if (!matched) return null;

    const entry = matched.handlers.get(httpMethod) || (matched.handlers.has("ALL") ? matched.handlers.get("ALL") : undefined);
    if (!entry) return null;

    let params: Record<string, string> = EMPTY_PARAMS;
    const names = entry.paramNames;
    if (names.length > 0 || entry.wildcardName) {
      params = {};
      for (let i = 0; i < names.length; i++) {
        params[names[i]!] = buffer[i]!;
      }
      if (entry.wildcardName) {
        params[entry.wildcardName] = buffer[names.length]!;
      }
    }

    return {
      handler: entry.handler,
      params,
      middleware: entry.middleware,
      metadata: entry.metadata,
      path: entry.path,
      method: entry.method
    };
  }

  private matchDynamic(
    current: Node,
    path: string,
    start: number,
    end: number,
    buffer: string[],
    depth: number
  ): Node | null {
    if (start >= end) {
      return current.handlers.size > 0 ? current : null;
    }

    let nextSlash = start;
    while (nextSlash < end && path.charCodeAt(nextSlash) !== 47) {
      nextSlash++;
    }

    const seg = path.substring(start, nextSlash);
    let nextStart = nextSlash + 1;
    while (nextStart < end && path.charCodeAt(nextStart) === 47) nextStart++;

    // 1. Static child lookup (highest priority)
    const staticChild = current.staticChildren.get(seg);
    if (staticChild) {
      const res = this.matchDynamic(staticChild, path, nextStart, end, buffer, depth);
      if (res) return res;
    }

    // 2. Param child lookup (second priority)
    if (current.paramChild) {
      buffer[depth] = seg;
      const res = this.matchDynamic(current.paramChild, path, nextStart, end, buffer, depth + 1);
      if (res) return res;
    }

    // 3. Wildcard child lookup (third priority)
    if (current.wildcardChild) {
      buffer[depth] = path.substring(start, end);
      return current.wildcardChild;
    }

    return null;
  }

  public getRoutes(): RouteEntry[] {
    return [...this.entries];
  }
}
