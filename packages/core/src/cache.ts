export interface CacheOptions {
  ttl?: string | number; // e.g. "60s", "10m", "1h", or milliseconds
  tags?: string[];
  swr?: boolean; // Stale-While-Revalidate
}

interface CacheEntry<T = any> {
  value: T;
  expiresAt: number;
  tags: string[];
  swr: boolean;
  revalidating?: boolean;
}

export function parseTtlToMs(ttl?: string | number): number {
  if (!ttl) return 60000;
  if (typeof ttl === "number") return ttl;
  const match = ttl.trim().match(/^(\d+)\s*(ms|s|m|h|d)?$/i);
  if (!match) return 60000;

  const val = parseInt(match[1]!, 10);
  const unit = (match[2] || "s").toLowerCase();

  switch (unit) {
    case "ms": return val;
    case "s": return val * 1000;
    case "m": return val * 60 * 1000;
    case "h": return val * 60 * 60 * 1000;
    case "d": return val * 24 * 60 * 60 * 1000;
    default: return val * 1000;
  }
}

export class ApexCache {
  private store = new Map<string, CacheEntry>();
  private tagIndex = new Map<string, Set<string>>();
  private maxEntries: number;

  constructor(maxEntries: number = 5000) {
    this.maxEntries = maxEntries;
  }

  public get<T = any>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    const isExpired = Date.now() > entry.expiresAt;
    if (isExpired) {
      if (!entry.swr) {
        this.delete(key);
        return undefined;
      }
      // With SWR, return stale value while flagging
    }

    return entry.value as T;
  }

  public set<T = any>(key: string, value: T, options: CacheOptions = {}): void {
    if (this.store.size >= this.maxEntries) {
      // Evict oldest entry
      const oldestKey = this.store.keys().next().value;
      if (oldestKey) this.delete(oldestKey);
    }

    const ttlMs = parseTtlToMs(options.ttl);
    const expiresAt = Date.now() + ttlMs;
    const tags = options.tags || [];

    const entry: CacheEntry<T> = {
      value,
      expiresAt,
      tags,
      swr: options.swr ?? false
    };

    this.store.set(key, entry);

    // Index tags
    for (const tag of tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(key);
    }
  }

  public delete(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;

    // Clean tag indices
    for (const tag of entry.tags) {
      this.tagIndex.get(tag)?.delete(key);
    }

    return this.store.delete(key);
  }

  public invalidate(tag: string): number {
    const keys = this.tagIndex.get(tag);
    if (!keys) return 0;

    let count = 0;
    for (const key of keys) {
      if (this.store.delete(key)) {
        count++;
      }
    }
    this.tagIndex.delete(tag);
    return count;
  }

  public clear(): void {
    this.store.clear();
    this.tagIndex.clear();
  }

  public size(): number {
    return this.store.size;
  }
}

export const cache = new ApexCache();
