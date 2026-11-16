import { ApexRequestContext, ApexSseResult } from "@apex14/http";
import { getActiveScope, type ApexScope } from "./scope.js";
import { getDistributedStateDriver, MemoryStateDriver } from "./state.js";
import type { RouteOptions } from "./types.js";

export type LiveListener = (tag: string, payload?: any) => void;

class LiveBus {
  private listeners = new Set<LiveListener>();

  public on(listener: LiveListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public emit(tag: string, payload?: any): void {
    for (const listener of this.listeners) {
      try {
        listener(tag, payload);
      } catch {
        // Safe ignore listener error
      }
    }
    const stateDriver = getDistributedStateDriver();
    if (!(stateDriver instanceof MemoryStateDriver)) {
      stateDriver.publish(`apex14:live:${tag}`, { tag, payload }).catch(() => {});
    }
  }
}

export const liveBus = new LiveBus();

// Attach to global hook so @apex14/database model mutations notify automatically
(globalThis as any).__apex14_live_notify = (tag: string, payload?: any) => {
  liveBus.emit(tag, payload);
};

export interface LiveQueryOptions extends RouteOptions {
  model?: string | string[];
  pollIntervalMs?: number;
}

export function live(
  path: string,
  queryFn: (ctx: ApexRequestContext) => any | Promise<any>,
  options: LiveQueryOptions = {}
): void {
  const scope: ApexScope = getActiveScope();
  const models = options.model
    ? Array.isArray(options.model)
      ? options.model
      : [options.model]
    : [];

  scope.sse(
    path,
    async function* (ctx: ApexRequestContext) {
      // 1. Initial snapshot
      let currentData = await queryFn(ctx);
      yield {
        type: "snapshot",
        data: currentData,
        timestamp: Date.now()
      };

      // 2. Setup reactive queue
      const queue: Array<{ type: string; data: any; timestamp: number }> = [];
      let notifyResolver: (() => void) | null = null;

      const triggerUpdate = async (tag: string, payload?: any) => {
        try {
          const freshData = await queryFn(ctx);
          // Check if data actually changed
          if (JSON.stringify(freshData) !== JSON.stringify(currentData)) {
            currentData = freshData;
            queue.push({
              type: "update",
              data: currentData,
              timestamp: Date.now()
            });
            if (notifyResolver) {
              notifyResolver();
              notifyResolver = null;
            }
          }
        } catch {
          // Ignore transient query evaluation error
        }
      };

      // Subscribe to model mutations
      const unsub = liveBus.on((tag, payload) => {
        if (models.length === 0 || models.includes(tag)) {
          triggerUpdate(tag, payload);
        }
      });

      // Optional polling fallback
      let pollTimer: NodeJS.Timeout | null = null;
      if (options.pollIntervalMs && options.pollIntervalMs > 0) {
        pollTimer = setInterval(() => {
          triggerUpdate("*");
        }, options.pollIntervalMs);
      }

      try {
        while (!ctx.request.signal?.aborted) {
          if (queue.length > 0) {
            const msg = queue.shift()!;
            yield msg;
          } else {
            await new Promise<void>((resolve) => {
              notifyResolver = resolve;
              // Wake up on abort
              ctx.request.signal?.addEventListener("abort", () => resolve(), { once: true });
            });
          }
        }
      } finally {
        unsub();
        if (pollTimer) clearInterval(pollTimer);
      }
    },
    {
      ...options,
      summary: options.summary || `Live query on ${path}`,
      tags: [...(options.tags || []), "Live Queries"]
    }
  );
}

export namespace live {
  export function notify(tag: string, payload?: any): void {
    liveBus.emit(tag, payload);
  }
}
