import { ApexRequestContext } from "@apex14/http";
import { getActiveScope, type ApexScope } from "./scope.js";
import type { Middleware } from "./types.js";

function formatLabels(labels?: Record<string, string | number>): string {
  if (!labels || Object.keys(labels).length === 0) return "";
  const parts = Object.entries(labels).map(([k, v]) => `${k}="${String(v).replace(/"/g, '\\"')}"`);
  return `{${parts.join(",")}}`;
}

export class ApexCounter {
  public readonly name: string;
  public readonly help: string;
  private values = new Map<string, number>();

  constructor(name: string, help: string = "") {
    this.name = name;
    this.help = help;
  }

  public inc(val: number = 1, labels?: Record<string, string | number>): void {
    const key = formatLabels(labels);
    const curr = this.values.get(key) || 0;
    this.values.set(key, curr + val);
  }

  public get(labels?: Record<string, string | number>): number {
    const key = formatLabels(labels);
    return this.values.get(key) || 0;
  }

  public toPrometheus(): string {
    const lines: string[] = [];
    if (this.help) lines.push(`# HELP ${this.name} ${this.help}`);
    lines.push(`# TYPE ${this.name} counter`);
    for (const [labels, val] of this.values.entries()) {
      lines.push(`${this.name}${labels} ${val}`);
    }
    return lines.join("\n");
  }

  public clear(): void {
    this.values.clear();
  }
}

export class ApexGauge {
  public readonly name: string;
  public readonly help: string;
  private values = new Map<string, number>();

  constructor(name: string, help: string = "") {
    this.name = name;
    this.help = help;
  }

  public set(val: number, labels?: Record<string, string | number>): void {
    const key = formatLabels(labels);
    this.values.set(key, val);
  }

  public inc(val: number = 1, labels?: Record<string, string | number>): void {
    const key = formatLabels(labels);
    const curr = this.values.get(key) || 0;
    this.values.set(key, curr + val);
  }

  public dec(val: number = 1, labels?: Record<string, string | number>): void {
    this.inc(-val, labels);
  }

  public get(labels?: Record<string, string | number>): number {
    const key = formatLabels(labels);
    return this.values.get(key) || 0;
  }

  public toPrometheus(): string {
    const lines: string[] = [];
    if (this.help) lines.push(`# HELP ${this.name} ${this.help}`);
    lines.push(`# TYPE ${this.name} gauge`);
    for (const [labels, val] of this.values.entries()) {
      lines.push(`${this.name}${labels} ${val}`);
    }
    return lines.join("\n");
  }

  public clear(): void {
    this.values.clear();
  }
}

export class ApexHistogram {
  public readonly name: string;
  public readonly help: string;
  public readonly buckets: number[];
  private bucketCounts = new Map<string, Map<number, number>>();
  private sums = new Map<string, number>();
  private counts = new Map<string, number>();

  constructor(
    name: string,
    help: string = "",
    buckets: number[] = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
  ) {
    this.name = name;
    this.help = help;
    this.buckets = [...buckets].sort((a, b) => a - b);
  }

  public observe(val: number, labels?: Record<string, string | number>): void {
    const key = formatLabels(labels);

    // Sum & Count
    this.sums.set(key, (this.sums.get(key) || 0) + val);
    this.counts.set(key, (this.counts.get(key) || 0) + 1);

    // Buckets
    let bMap = this.bucketCounts.get(key);
    if (!bMap) {
      bMap = new Map();
      this.bucketCounts.set(key, bMap);
    }

    for (const b of this.buckets) {
      if (val <= b) {
        bMap.set(b, (bMap.get(b) || 0) + 1);
      }
    }
  }

  public startTimer(labels?: Record<string, string | number>): () => number {
    const start = Date.now();
    return () => {
      const deltaSec = (Date.now() - start) / 1000;
      this.observe(deltaSec, labels);
      return deltaSec;
    };
  }

  public toPrometheus(): string {
    const lines: string[] = [];
    if (this.help) lines.push(`# HELP ${this.name} ${this.help}`);
    lines.push(`# TYPE ${this.name} histogram`);

    const allKeys = new Set([...this.counts.keys()]);
    for (const labelStr of allKeys) {
      const bMap = this.bucketCounts.get(labelStr) || new Map();
      const count = this.counts.get(labelStr) || 0;
      const sum = this.sums.get(labelStr) || 0;

      // Extract existing labels to merge with le="..."
      const rawLabels = labelStr ? labelStr.slice(1, -1) : "";

      for (const b of this.buckets) {
        const bCount = bMap.get(b) || 0;
        const bLabels = rawLabels ? `{${rawLabels},le="${b}"}` : `{le="${b}"}`;
        lines.push(`${this.name}_bucket${bLabels} ${bCount}`);
      }

      const infLabels = rawLabels ? `{${rawLabels},le="+Inf"}` : `{le="+Inf"}`;
      lines.push(`${this.name}_bucket${infLabels} ${count}`);
      lines.push(`${this.name}_sum${labelStr} ${sum}`);
      lines.push(`${this.name}_count${labelStr} ${count}`);
    }

    return lines.join("\n");
  }

  public clear(): void {
    this.bucketCounts.clear();
    this.sums.clear();
    this.counts.clear();
  }
}

export class ApexMetricEngine {
  private counters = new Map<string, ApexCounter>();
  private gauges = new Map<string, ApexGauge>();
  private histograms = new Map<string, ApexHistogram>();

  // Default global HTTP metrics
  public readonly httpRequestsTotal = new ApexCounter("http_requests_total", "Total incoming HTTP requests");
  public readonly httpRequestDurationSeconds = new ApexHistogram(
    "http_request_duration_seconds",
    "HTTP request latency in seconds"
  );

  public counter(name: string, help: string = ""): ApexCounter {
    let c = this.counters.get(name);
    if (!c) {
      c = new ApexCounter(name, help);
      this.counters.set(name, c);
    }
    return c;
  }

  public gauge(name: string, help: string = ""): ApexGauge {
    let g = this.gauges.get(name);
    if (!g) {
      g = new ApexGauge(name, help);
      this.gauges.set(name, g);
    }
    return g;
  }

  public histogram(name: string, help: string = "", buckets?: number[]): ApexHistogram {
    let h = this.histograms.get(name);
    if (!h) {
      h = new ApexHistogram(name, help, buckets);
      this.histograms.set(name, h);
    }
    return h;
  }

  public middleware(): Middleware {
    return async (ctx: ApexRequestContext, next: () => Promise<any>) => {
      const endTimer = this.httpRequestDurationSeconds.startTimer({
        method: ctx.request.method,
        path: ctx.url.pathname
      });

      try {
        const res = await next();
        const status = ctx.responseStatus || 200;
        this.httpRequestsTotal.inc(1, {
          method: ctx.request.method,
          status: String(status)
        });
        endTimer();
        return res;
      } catch (err: any) {
        const status = err.status || 500;
        this.httpRequestsTotal.inc(1, {
          method: ctx.request.method,
          status: String(status)
        });
        endTimer();
        throw err;
      }
    };
  }

  public exportPrometheus(): string {
    const blocks: string[] = [];

    // Global HTTP metrics
    const reqProm = this.httpRequestsTotal.toPrometheus();
    if (reqProm) blocks.push(reqProm);

    const durProm = this.httpRequestDurationSeconds.toPrometheus();
    if (durProm) blocks.push(durProm);

    // Custom metrics
    for (const c of this.counters.values()) {
      blocks.push(c.toPrometheus());
    }
    for (const g of this.gauges.values()) {
      blocks.push(g.toPrometheus());
    }
    for (const h of this.histograms.values()) {
      blocks.push(h.toPrometheus());
    }

    return blocks.filter((b) => b.trim().length > 0).join("\n\n") + "\n";
  }

  public enableMetrics(options: { path?: string; scope?: ApexScope } = {}): void {
    const scope = options.scope || getActiveScope();
    const endpoint = options.path || "/_metrics";

    scope.route(endpoint, () => {
      const text = this.exportPrometheus();
      return new Response(text, {
        headers: {
          "content-type": "text/plain; version=0.0.4; charset=utf-8"
        }
      });
    });
  }

  public clear(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.httpRequestsTotal.clear();
    this.httpRequestDurationSeconds.clear();
  }
}

export const metric = new ApexMetricEngine();
