import type { TaskOptions, TaskDispatcher, ScheduleOptions, ScheduledJob } from "./types.js";
import { getDistributedDriver } from "./distributed/index.js";

export class TaskQueue<TData = any, TResult = any> implements TaskDispatcher<TData, TResult> {
  public name: string;
  private handler: (data: TData) => Promise<TResult>;
  private options: TaskOptions;
  private queue: Array<{ data: TData; retriesLeft: number; resolve?: (val: any) => void; reject?: (err: any) => void }> = [];
  private activeCount = 0;

  constructor(
    name: string,
    handler: (data: TData) => Promise<TResult>,
    options: TaskOptions = {}
  ) {
    this.name = name;
    this.handler = handler;
    this.options = {
      concurrency: 5,
      retries: 2,
      retryDelayMs: 500,
      ...options
    };
  }

  public dispatch(data: TData): void {
    this.queue.push({ data, retriesLeft: this.options.retries || 0 });
    this.processNext();
  }

  public async dispatchDistributed(data: TData): Promise<void> {
    const driver = getDistributedDriver();
    if (driver.name !== "memory") {
      await driver.taskPush(this.name, data);
    } else {
      this.dispatch(data);
    }
  }

  public async runNow(data: TData): Promise<TResult> {
    return await this.handler(data);
  }

  private async processNext(): Promise<void> {
    if (this.activeCount >= (this.options.concurrency || 5) || this.queue.length === 0) {
      return;
    }

    const item = this.queue.shift();
    if (!item) return;

    this.activeCount++;

    (async () => {
      try {
        const result = await this.handler(item.data);
        if (item.resolve) item.resolve(result);
      } catch (err) {
        if (item.retriesLeft > 0) {
          item.retriesLeft--;
          setTimeout(() => {
            this.queue.unshift(item);
            this.processNext();
          }, this.options.retryDelayMs || 500);
        } else {
          if (item.reject) item.reject(err);
          console.error(`[APEX14 Task] Task '${this.name}' failed:`, err);
        }
      } finally {
        this.activeCount--;
        this.processNext();
      }
    })();
  }
}

export function parseIntervalToMs(interval: string | number): number {
  if (typeof interval === "number") return interval;
  const match = interval.trim().match(/^(\d+)\s*(ms|s|m|h|d)?$/i);
  if (!match) return 60000; // default 1 minute

  const val = parseInt(match[1]!, 10);
  const unit = (match[2] || "s").toLowerCase();

  switch (unit) {
    case "ms":
      return val;
    case "s":
      return val * 1000;
    case "m":
      return val * 60 * 1000;
    case "h":
      return val * 60 * 60 * 1000;
    case "d":
      return val * 24 * 60 * 60 * 1000;
    default:
      return val * 1000;
  }
}

export class TaskScheduler {
  private jobs: ScheduledJob[] = [];

  public schedule(
    patternOrOptions: string | ScheduleOptions,
    handler: () => void | Promise<void>
  ): ScheduledJob {
    const pattern = typeof patternOrOptions === "string" ? patternOrOptions : patternOrOptions.cron || String(patternOrOptions.interval || "1m");
    const name = typeof patternOrOptions === "object" && patternOrOptions.name ? patternOrOptions.name : `job_${Date.now()}`;

    const ms = parseIntervalToMs(pattern);
    const timer = setInterval(async () => {
      try {
        await handler();
      } catch (err) {
        console.error(`[APEX14 Scheduler] Job '${name}' error:`, err);
      }
    }, ms);

    if (timer.unref) timer.unref();

    const job: ScheduledJob = {
      name,
      pattern,
      stop: () => clearInterval(timer)
    };

    this.jobs.push(job);
    return job;
  }

  public stopAll(): void {
    for (const j of this.jobs) {
      j.stop();
    }
    this.jobs = [];
  }
}
