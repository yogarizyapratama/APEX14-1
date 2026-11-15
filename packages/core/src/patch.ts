import { getActiveScope, type ApexScope } from "./scope.js";
import type { Handler, MethodMap, RouteOptions } from "./types.js";
import type { HttpMethod } from "@apex14/router";

export interface PatchRecord {
  id: string;
  path: string;
  method: string;
  timestamp: number;
  previousHandler?: Handler;
  newHandler: Handler | MethodMap;
  options?: RouteOptions;
}

export type PatchListener = (record: PatchRecord) => void;

export class ApexPatchEngine {
  private patches: PatchRecord[] = [];
  private listeners: PatchListener[] = [];

  public route(
    scopeOrPath: ApexScope | string,
    pathOrHandler: string | Handler | MethodMap,
    handlerOrOptions?: Handler | MethodMap | RouteOptions,
    maybeOptions?: RouteOptions
  ): PatchRecord {
    let scope: ApexScope;
    let path: string;
    let handlerOrMethods: Handler | MethodMap;
    let options: RouteOptions = {};

    if (typeof scopeOrPath === "string") {
      scope = getActiveScope();
      path = scopeOrPath;
      handlerOrMethods = pathOrHandler as Handler | MethodMap;
      options = (handlerOrOptions as RouteOptions) || {};
    } else {
      scope = scopeOrPath;
      path = pathOrHandler as string;
      handlerOrMethods = handlerOrOptions as Handler | MethodMap;
      options = maybeOptions || {};
    }

    const defaultMethod = (options.method || "GET").toUpperCase();
    const existingEntry = scope.routesManifest.find(
      (r) => r.path === path && (typeof handlerOrMethods === "function" ? r.method === defaultMethod : true)
    );

    const record: PatchRecord = {
      id: `patch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      path,
      method: defaultMethod,
      timestamp: Date.now(),
      previousHandler: existingEntry?.handler,
      newHandler: handlerOrMethods,
      options
    };

    // Remove existing manifest entries for this path to keep manifest clean
    if (typeof handlerOrMethods === "function") {
      scope.routesManifest = scope.routesManifest.filter(
        (r) => !(r.path === path && r.method === defaultMethod)
      );
    } else {
      const methods = Object.keys(handlerOrMethods).map((m) => m.toUpperCase());
      scope.routesManifest = scope.routesManifest.filter(
        (r) => !(r.path === path && methods.includes(r.method))
      );
    }

    // Apply the new route in scope
    scope.route(path, handlerOrMethods, options);

    this.patches.push(record);
    for (const listener of this.listeners) {
      try {
        listener(record);
      } catch {
        // ignore listener errors
      }
    }

    return record;
  }

  public rollback(path: string, scope = getActiveScope()): boolean {
    const reversed = [...this.patches].reverse();
    const lastPatch = reversed.find((p) => p.path === path && p.previousHandler);
    if (!lastPatch || !lastPatch.previousHandler) {
      return false;
    }

    scope.route(path, lastPatch.previousHandler, lastPatch.options);
    this.patches.push({
      id: `rollback_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      path,
      method: lastPatch.method,
      timestamp: Date.now(),
      previousHandler: lastPatch.newHandler as any,
      newHandler: lastPatch.previousHandler,
      options: lastPatch.options
    });
    return true;
  }

  public history(): PatchRecord[] {
    return [...this.patches];
  }

  public onPatch(listener: PatchListener): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx !== -1) this.listeners.splice(idx, 1);
    };
  }

  public clear(): void {
    this.patches = [];
    this.listeners = [];
  }
}

export const patch = new ApexPatchEngine();
