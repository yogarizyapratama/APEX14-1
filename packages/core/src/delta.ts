import { ApexRequestContext, ValidationError } from "@apex14/http";
import type { Handler } from "./types.js";

export type PatchOpType = "add" | "remove" | "replace";

export interface PatchOperation {
  op: PatchOpType;
  path: string;
  value?: any;
}

function parseJsonPointer(path: string): string[] {
  if (!path || path === "/") return [];
  const parts = path.startsWith("/") ? path.slice(1).split("/") : path.split("/");
  return parts.map((p) => p.replace(/~1/g, "/").replace(/~0/g, "~"));
}

function deepClone<T>(val: T): T {
  if (val === undefined || val === null) return val;
  return JSON.parse(JSON.stringify(val));
}

function isObject(val: any): val is Record<string, any> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

export class ApexDeltaEngine {
  /**
   * Compares two objects or arrays and computes minimal RFC 6902 JSON Patch operations.
   */
  public diff(prev: any, next: any, basePath = ""): PatchOperation[] {
    const patches: PatchOperation[] = [];

    if (prev === next) {
      return patches;
    }

    if (!isObject(prev) || !isObject(next)) {
      if (Array.isArray(prev) && Array.isArray(next)) {
        return this.diffArrays(prev, next, basePath);
      }
      // Primitive or type changed
      patches.push({
        op: "replace",
        path: basePath || "/",
        value: next
      });
      return patches;
    }

    const prevKeys = Object.keys(prev);
    const nextKeys = Object.keys(next);

    // Removed keys
    for (const key of prevKeys) {
      if (!(key in next)) {
        patches.push({
          op: "remove",
          path: `${basePath}/${key}`
        });
      }
    }

    // Added or modified keys
    for (const key of nextKeys) {
      const currentPath = `${basePath}/${key}`;
      if (!(key in prev)) {
        patches.push({
          op: "add",
          path: currentPath,
          value: next[key]
        });
      } else {
        const subPatches = this.diff(prev[key], next[key], currentPath);
        patches.push(...subPatches);
      }
    }

    return patches;
  }

  private diffArrays(prev: any[], next: any[], basePath: string): PatchOperation[] {
    const patches: PatchOperation[] = [];
    const minLen = Math.min(prev.length, next.length);

    for (let i = 0; i < minLen; i++) {
      const sub = this.diff(prev[i], next[i], `${basePath}/${i}`);
      patches.push(...sub);
    }

    if (next.length > prev.length) {
      for (let i = prev.length; i < next.length; i++) {
        patches.push({
          op: "add",
          path: `${basePath}/${i}`,
          value: next[i]
        });
      }
    } else if (prev.length > next.length) {
      for (let i = prev.length - 1; i >= next.length; i--) {
        patches.push({
          op: "remove",
          path: `${basePath}/${i}`
        });
      }
    }

    return patches;
  }

  /**
   * Immutably applies an array of RFC 6902 patches to a target document.
   */
  public apply<T = any>(target: T, patches: PatchOperation[]): T {
    if (!Array.isArray(patches)) {
      throw new ValidationError("Patches must be an array of RFC 6902 operations");
    }

    let root = deepClone(target) as any;

    for (const patch of patches) {
      const parts = parseJsonPointer(patch.path);

      if (parts.length === 0) {
        if (patch.op === "replace" || patch.op === "add") {
          root = deepClone(patch.value);
        } else if (patch.op === "remove") {
          root = undefined;
        }
        continue;
      }

      let current = root;
      for (let i = 0; i < parts.length - 1; i++) {
        const key = parts[i]!;
        if (current === undefined || current === null) {
          throw new ValidationError(`Cannot navigate to path '${patch.path}': parent is null or undefined`);
        }
        current = current[key];
      }

      const lastKey = parts[parts.length - 1]!;

      switch (patch.op) {
        case "add": {
          if (Array.isArray(current)) {
            const index = lastKey === "-" ? current.length : parseInt(lastKey, 10);
            current.splice(index, 0, deepClone(patch.value));
          } else if (isObject(current)) {
            current[lastKey] = deepClone(patch.value);
          }
          break;
        }
        case "remove": {
          if (Array.isArray(current)) {
            const index = parseInt(lastKey, 10);
            current.splice(index, 1);
          } else if (isObject(current)) {
            delete current[lastKey];
          }
          break;
        }
        case "replace": {
          if (Array.isArray(current)) {
            const index = parseInt(lastKey, 10);
            current[index] = deepClone(patch.value);
          } else if (isObject(current)) {
            current[lastKey] = deepClone(patch.value);
          }
          break;
        }
        default:
          throw new ValidationError(`Unsupported patch operation '${(patch as any).op}'`);
      }
    }

    return root as T;
  }

  /**
   * Route handler wrapper for HTTP PATCH endpoints conforming to RFC 6902.
   */
  public patch(
    handler: (id: string, patches: PatchOperation[], ctx: ApexRequestContext) => Promise<any> | any
  ): Handler {
    return async (ctx: ApexRequestContext) => {
      const patches = ctx.body;
      if (!Array.isArray(patches)) {
        throw new ValidationError("Request body must be an array of RFC 6902 JSON patch operations");
      }
      const id = ctx.params.id || "";
      return await handler(id, patches, ctx);
    };
  }
}

export const delta = new ApexDeltaEngine();
