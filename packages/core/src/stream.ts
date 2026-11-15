import { ApexRequestContext } from "@apex14/http";
import type { Middleware } from "./types.js";

export class ApexStreamPipeline<T = any> {
  private source: AsyncIterable<T>;

  constructor(source: AsyncIterable<T> | Iterable<T>) {
    if (Symbol.asyncIterator in source) {
      this.source = source as AsyncIterable<T>;
    } else {
      this.source = (async function* () {
        for (const item of source as Iterable<T>) {
          yield item;
        }
      })();
    }
  }

  public [Symbol.asyncIterator](): AsyncIterator<T> {
    return this.source[Symbol.asyncIterator]();
  }

  public transform<R>(fn: (item: T) => R | Promise<R>): ApexStreamPipeline<R> {
    const parent = this.source;
    async function* transformed() {
      for await (const item of parent) {
        yield await fn(item);
      }
    }
    return new ApexStreamPipeline<R>(transformed());
  }

  public filter(predicate: (item: T) => boolean | Promise<boolean>): ApexStreamPipeline<T> {
    const parent = this.source;
    async function* filtered() {
      for await (const item of parent) {
        if (await predicate(item)) {
          yield item;
        }
      }
    }
    return new ApexStreamPipeline<T>(filtered());
  }

  public batch(size: number): ApexStreamPipeline<T[]> {
    const parent = this.source;
    const batchSize = Math.max(1, size);
    async function* batched() {
      let currentBatch: T[] = [];
      for await (const item of parent) {
        currentBatch.push(item);
        if (currentBatch.length >= batchSize) {
          yield currentBatch;
          currentBatch = [];
        }
      }
      if (currentBatch.length > 0) {
        yield currentBatch;
      }
    }
    return new ApexStreamPipeline<T[]>(batched());
  }

  public take(limit: number): ApexStreamPipeline<T> {
    const parent = this.source;
    async function* taken() {
      let count = 0;
      for await (const item of parent) {
        if (count >= limit) break;
        yield item;
        count++;
      }
    }
    return new ApexStreamPipeline<T>(taken());
  }

  public skip(count: number): ApexStreamPipeline<T> {
    const parent = this.source;
    async function* skipped() {
      let skippedCount = 0;
      for await (const item of parent) {
        if (skippedCount < count) {
          skippedCount++;
          continue;
        }
        yield item;
      }
    }
    return new ApexStreamPipeline<T>(skipped());
  }

  public toReadableStream(): ReadableStream<Uint8Array> {
    const iterator = this.source[Symbol.asyncIterator]();
    const encoder = new TextEncoder();

    return new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const { value, done } = await iterator.next();
          if (done) {
            controller.close();
          } else {
            const chunk = typeof value === "string" ? value : JSON.stringify(value);
            controller.enqueue(encoder.encode(chunk));
          }
        } catch (err) {
          controller.error(err);
        }
      }
    });
  }

  public toNdjson(): Response {
    const iterator = this.source[Symbol.asyncIterator]();
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const { value, done } = await iterator.next();
          if (done) {
            controller.close();
          } else {
            const line = (typeof value === "string" ? value : JSON.stringify(value)) + "\n";
            controller.enqueue(encoder.encode(line));
          }
        } catch (err) {
          controller.error(err);
        }
      }
    });

    return new Response(stream, {
      headers: {
        "content-type": "application/x-ndjson; charset=utf-8",
        "transfer-encoding": "chunked"
      }
    });
  }

  public toCsv(columns?: string[]): Response {
    const iterator = this.source[Symbol.asyncIterator]();
    const encoder = new TextEncoder();
    let headerSent = false;
    let actualColumns = columns;

    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const { value, done } = await iterator.next();
          if (done) {
            controller.close();
            return;
          }

          if (!headerSent) {
            if (!actualColumns && typeof value === "object" && value !== null) {
              actualColumns = Object.keys(value);
            }
            if (actualColumns && actualColumns.length > 0) {
              controller.enqueue(encoder.encode(actualColumns.join(",") + "\n"));
            }
            headerSent = true;
          }

          if (typeof value === "object" && value !== null) {
            const cols = actualColumns || Object.keys(value);
            const row = cols.map((c) => {
              const val = (value as any)[c];
              if (val === null || val === undefined) return "";
              const str = String(val);
              return str.includes(",") || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
            }).join(",");
            controller.enqueue(encoder.encode(row + "\n"));
          } else {
            controller.enqueue(encoder.encode(String(value) + "\n"));
          }
        } catch (err) {
          controller.error(err);
        }
      }
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "transfer-encoding": "chunked"
      }
    });
  }

  public async collect(): Promise<T[]> {
    const results: T[] = [];
    for await (const item of this.source) {
      results.push(item);
    }
    return results;
  }

  public async forEach(fn: (item: T) => Promise<void> | void): Promise<void> {
    for await (const item of this.source) {
      await fn(item);
    }
  }
}

export class ApexStreamEngine {
  public from<T = any>(source: AsyncIterable<T> | Iterable<T> | T[]): ApexStreamPipeline<T> {
    return new ApexStreamPipeline<T>(source);
  }

  public fromQuery<T = any>(cursorOrList: any): ApexStreamPipeline<T> {
    if (cursorOrList && typeof cursorOrList[Symbol.asyncIterator] === "function") {
      return new ApexStreamPipeline<T>(cursorOrList);
    }
    if (Array.isArray(cursorOrList)) {
      return new ApexStreamPipeline<T>(cursorOrList);
    }
    if (cursorOrList && typeof cursorOrList.then === "function") {
      async function* fromPromise() {
        const resolved = await cursorOrList;
        if (Array.isArray(resolved)) {
          for (const item of resolved) yield item;
        } else {
          yield resolved;
        }
      }
      return new ApexStreamPipeline<T>(fromPromise());
    }
    return new ApexStreamPipeline<T>([cursorOrList]);
  }

  public consumer(options: {
    onChunk: (batch: any[]) => Promise<void>;
    batchSize?: number;
    maxMemoryMb?: number;
  }): Middleware {
    const batchSize = options.batchSize || 100;
    return async (ctx: ApexRequestContext, next: () => Promise<any>) => {
      if (Array.isArray(ctx.body)) {
        for (let i = 0; i < ctx.body.length; i += batchSize) {
          const chunk = ctx.body.slice(i, i + batchSize);
          await options.onChunk(chunk);
        }
      }
      return await next();
    };
  }
}

export const stream = new ApexStreamEngine();
