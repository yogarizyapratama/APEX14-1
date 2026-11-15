export interface OutboxEvent<T = any> {
  id: string;
  name: string;
  payload: T;
  status: "pending" | "published" | "failed";
  attempts: number;
  createdAt: string;
  publishedAt?: string;
  error?: string;
}

export type EventHandler<T = any> = (payload: T, event: OutboxEvent<T>) => void | Promise<void>;

export class ApexEvent<T = any> {
  public name: string;
  private subscribers = new Set<EventHandler<T>>();

  constructor(name: string) {
    this.name = name;
    eventRegistry.set(name, this as any);
  }

  public subscribe(handler: EventHandler<T>): () => void {
    this.subscribers.add(handler);
    return () => this.subscribers.delete(handler);
  }

  public async publish(
    payload: T,
    options: { transactional?: boolean } = {}
  ): Promise<{ eventId: string; status: "published" | "queued" }> {
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const eventRecord: OutboxEvent<T> = {
      id: eventId,
      name: this.name,
      payload,
      status: "pending",
      attempts: 0,
      createdAt: new Date().toISOString()
    };

    outboxStore.push(eventRecord);

    if (options.transactional) {
      // In transactional mode, event is safely enqueued in outbox for asynchronous flush
      return { eventId, status: "queued" };
    }

    // Direct immediate dispatch
    await this.dispatchRecord(eventRecord);
    return { eventId, status: eventRecord.status === "published" ? "published" : "queued" };
  }

  public async dispatchRecord(record: OutboxEvent<T>): Promise<void> {
    record.attempts++;
    try {
      for (const sub of this.subscribers) {
        await sub(record.payload, record);
      }
      record.status = "published";
      record.publishedAt = new Date().toISOString();
    } catch (err: any) {
      record.status = "failed";
      record.error = err.message || String(err);
      throw err;
    }
  }
}

export const eventRegistry = new Map<string, ApexEvent>();
export const outboxStore: OutboxEvent[] = [];

export function event<T = any>(name: string): ApexEvent<T> {
  let existing = eventRegistry.get(name);
  if (!existing) {
    existing = new ApexEvent<T>(name);
  }
  return existing as ApexEvent<T>;
}

export namespace event {
  export async function flushOutbox(): Promise<number> {
    let processed = 0;
    const pending = outboxStore.filter((e) => e.status === "pending" || e.status === "failed");
    for (const item of pending) {
      const evt = eventRegistry.get(item.name);
      if (evt) {
        try {
          await evt.dispatchRecord(item);
          processed++;
        } catch {
          // Retry later
        }
      }
    }
    return processed;
  }

  export function getOutbox(): OutboxEvent[] {
    return [...outboxStore];
  }

  export function clear(): void {
    outboxStore.length = 0;
  }
}
