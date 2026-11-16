import { ApexError } from "@apex14/http";
import { getDistributedStateDriver, MemoryStateDriver } from "./state.js";
import { getDistributedDriver } from "./distributed/index.js";

export interface LockOptions {
  ttlMs?: number;
  timeoutMs?: number;
  retryDelayMs?: number;
}

export class LockAcquisitionError extends ApexError {
  constructor(key: string) {
    super(409, `Failed to acquire lock for key '${key}': timeout exceeded`, "LOCK_ACQUISITION_TIMEOUT");
    this.name = "LockAcquisitionError";
  }
}

interface ActiveLock {
  id: string;
  key: string;
  expiresAt: number;
}

export class ApexLockEngine {
  private locks = new Map<string, ActiveLock>();
  private waitQueues = new Map<string, Array<() => void>>();

  public async acquire(key: string, options: LockOptions = {}): Promise<string> {
    const ttlMs = options.ttlMs || 5000;
    const timeoutMs = options.timeoutMs || 3000;
    const retryDelayMs = options.retryDelayMs || 25;
    const startTime = Date.now();
    const lockId = `lock_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const stateDriver = getDistributedStateDriver();
    if (!(stateDriver instanceof MemoryStateDriver)) {
      while (true) {
        const token = await stateDriver.acquireLock(key, ttlMs);
        if (token) return token;

        if (Date.now() - startTime >= timeoutMs) {
          throw new LockAcquisitionError(key);
        }
        await new Promise((r) => setTimeout(r, retryDelayMs));
      }
    }

    const driver = getDistributedDriver();
    if (driver.name !== "memory") {
      while (true) {
        const acquired = await driver.lockAcquire(key, ttlMs, lockId);
        if (acquired) return lockId;

        if (Date.now() - startTime >= timeoutMs) {
          throw new LockAcquisitionError(key);
        }
        await new Promise((r) => setTimeout(r, retryDelayMs));
      }
    }

    while (true) {
      const now = Date.now();
      const existing = this.locks.get(key);

      // Check if lock expired
      if (existing && now >= existing.expiresAt) {
        this.locks.delete(key);
      }

      // Try acquiring
      if (!this.locks.has(key)) {
        this.locks.set(key, {
          id: lockId,
          key,
          expiresAt: now + ttlMs
        });
        return lockId;
      }

      // Check timeout
      if (now - startTime >= timeoutMs) {
        throw new LockAcquisitionError(key);
      }

      // Wait before next attempt
      await new Promise<void>((resolve) => {
        let queue = this.waitQueues.get(key);
        if (!queue) {
          queue = [];
          this.waitQueues.set(key, queue);
        }
        const timer = setTimeout(() => {
          resolve();
        }, retryDelayMs);

        queue.push(() => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
  }

  public async release(key: string, lockId: string): Promise<boolean> {
    const stateDriver = getDistributedStateDriver();
    if (!(stateDriver instanceof MemoryStateDriver)) {
      return await stateDriver.releaseLock(key, lockId);
    }

    const driver = getDistributedDriver();
    if (driver.name !== "memory") {
      return await driver.lockRelease(key, lockId);
    }

    const active = this.locks.get(key);
    if (active && active.id === lockId) {
      this.locks.delete(key);
      const queue = this.waitQueues.get(key);
      if (queue && queue.length > 0) {
        const nextInLine = queue.shift();
        if (nextInLine) nextInLine();
      }
      return true;
    }
    return false;
  }

  public async run<T>(
    key: string,
    optionsOrFn: LockOptions | (() => T | Promise<T>),
    maybeFn?: () => T | Promise<T>
  ): Promise<T> {
    const options: LockOptions = typeof optionsOrFn === "function" ? {} : optionsOrFn;
    const fn = (typeof optionsOrFn === "function" ? optionsOrFn : maybeFn)!;

    const lockId = await this.acquire(key, options);
    try {
      return await fn();
    } finally {
      await this.release(key, lockId);
    }
  }

  public clear(): void {
    this.locks.clear();
    this.waitQueues.clear();
  }
}

export const lockEngine = new ApexLockEngine();

export async function lock<T>(
  key: string,
  optionsOrFn: LockOptions | (() => T | Promise<T>),
  maybeFn?: () => T | Promise<T>
): Promise<T> {
  return await lockEngine.run(key, optionsOrFn, maybeFn);
}
