export interface DistributedDriver {
  name: string;

  // Cache Operations
  cacheGet<T = any>(key: string): Promise<T | null>;
  cacheSet<T = any>(key: string, value: T, ttlMs?: number): Promise<void>;
  cacheDel(key: string): Promise<void>;

  // Rate Limiting Operations
  rateLimitIncrement(key: string, windowMs: number): Promise<{ count: number; resetMs: number }>;

  // Distributed Lock Operations (Atomic Mutex)
  lockAcquire(key: string, ttlMs: number, lockId: string): Promise<boolean>;
  lockRelease(key: string, lockId: string): Promise<boolean>;

  // Distributed Task Queue Operations
  taskPush<T = any>(queueName: string, payload: T): Promise<void>;
  taskPop<T = any>(queueName: string, timeoutMs?: number): Promise<T | null>;

  // Pub/Sub Messaging
  publish(channel: string, message: string): Promise<void>;
  subscribe(channel: string, handler: (message: string) => void): Promise<() => void>;

  // Health & Lifecycle
  ping(): Promise<boolean>;
  close(): Promise<void>;
}
