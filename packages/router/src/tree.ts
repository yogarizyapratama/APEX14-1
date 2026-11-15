import type { HttpMethod, RouteEntry, RouteMatchResult } from "./types.js";

interface Node {
  part: string;
  isParam: boolean;
  paramName?: string;
  isWildcard: boolean;
  wildcardName?: string;
  children: Node[];
  handlers: Map<HttpMethod, RouteEntry>;
}

function createNode(part: string = "", isParam = false, paramName?: string, isWildcard = false, wildcardName?: string): Node {
  return {
    part,
    isParam,
    paramName,
    isWildcard,
    wildcardName,
    children: [],
    handlers: new Map()
  };
}

export class RadixRouter {
  private root: Node = createNode();
  private entries: RouteEntry[] = [];

  public add(entry: RouteEntry): void {
    this.entries.push(entry);
    const normalizedPath = this.normalizePath(entry.path);
    const segments = normalizedPath === "" ? [] : normalizedPath.split("/");

    let current = this.root;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]!;
      let isParam = false;
      let paramName: string | undefined;
      let isWildcard = false;
      let wildcardName: string | undefined;

      if (seg.startsWith(":")) {
        isParam = true;
        paramName = seg.slice(1);
      } else if (seg.startsWith("*")) {
        isWildcard = true;
        wildcardName = seg.length > 1 ? seg.slice(1) : "wildcard";
      }

      let child = current.children.find((c) => {
        if (isParam && c.isParam && c.paramName === paramName) return true;
        if (isWildcard && c.isWildcard) return true;
        return !isParam && !isWildcard && c.part === seg;
      });

      if (!child) {
        child = createNode(seg, isParam, paramName, isWildcard, wildcardName);
        current.children.push(child);
        // Sort children: static first, then param, then wildcard
        current.children.sort((a, b) => {
          const scoreA = a.isWildcard ? 2 : a.isParam ? 1 : 0;
          const scoreB = b.isWildcard ? 2 : b.isParam ? 1 : 0;
          return scoreA - scoreB;
        });
      }

      current = child;

      // If this was a wildcard, it consumes the rest of the path
      if (isWildcard) {
        break;
      }
    }

    current.handlers.set(entry.method, entry);
  }

  public match(method: string, path: string): RouteMatchResult | null {
    const httpMethod = method.toUpperCase() as HttpMethod;
    const normalizedPath = this.normalizePath(path);
    const segments = normalizedPath === "" ? [] : normalizedPath.split("/");

    const params: Record<string, string> = {};

    const matched = this.matchNode(this.root, segments, 0, params);
    if (!matched) return null;

    let entry = matched.handlers.get(httpMethod);
    if (!entry && matched.handlers.has("ALL")) {
      entry = matched.handlers.get("ALL");
    }

    if (!entry) return null;

    return {
      handler: entry.handler,
      params,
      middleware: entry.middleware,
      metadata: entry.metadata,
      path: entry.path,
      method: entry.method
    };
  }

  private matchNode(
    current: Node,
    segments: string[],
    index: number,
    params: Record<string, string>
  ): Node | null {
    if (index === segments.length) {
      if (current.handlers.size > 0) {
        return current;
      }
      return null;
    }

    const seg = segments[index]!;

    for (const child of current.children) {
      if (child.isWildcard) {
        const remaining = segments.slice(index).join("/");
        params[child.wildcardName || "wildcard"] = remaining;
        return child;
      }

      if (child.isParam) {
        params[child.paramName!] = seg;
        const res = this.matchNode(child, segments, index + 1, params);
        if (res) return res;
        delete params[child.paramName!];
      } else if (child.part === seg) {
        const res = this.matchNode(child, segments, index + 1, params);
        if (res) return res;
      }
    }

    return null;
  }

  public getRoutes(): RouteEntry[] {
    return [...this.entries];
  }

  private normalizePath(p: string): string {
    if (!p) return "";
    let clean = p.trim();
    if (clean.startsWith("/")) clean = clean.slice(1);
    if (clean.endsWith("/")) clean = clean.slice(0, -1);
    return clean;
  }
}
