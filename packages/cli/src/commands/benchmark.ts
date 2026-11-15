import { performance } from "node:perf_hooks";
import { getActiveScope, type ApexScope } from "@apex14/core";

export interface BenchmarkOptions {
  durationMs?: number;
  requests?: number;
  method?: string;
  body?: any;
  headers?: Record<string, string>;
  warmupRequests?: number;
}

export interface BenchmarkResult {
  path: string;
  method: string;
  totalRequests: number;
  durationMs: number;
  requestsPerSecond: number;
  latency: {
    min: number;
    max: number;
    mean: number;
    p50: number;
    p95: number;
    p99: number;
  };
  memory: {
    heapUsedMb: number;
    rssMb: number;
  };
}

export async function benchmarkRoute(
  scope: ApexScope = getActiveScope(),
  path: string = "/",
  options: BenchmarkOptions = {}
): Promise<BenchmarkResult> {
  const method = (options.method || "GET").toUpperCase();
  const warmup = options.warmupRequests !== undefined ? options.warmupRequests : 5;
  const maxRequests = options.requests || 100;
  const maxDuration = options.durationMs || 1000;

  const url = path.startsWith("http") ? path : `http://localhost${path.startsWith("/") ? "" : "/"}${path}`;

  // Warmup requests
  for (let i = 0; i < warmup; i++) {
    const req = new Request(url, {
      method,
      headers: options.headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    await scope.handle(req);
  }

  const latencies: number[] = [];
  const startTime = performance.now();
  let count = 0;

  while (count < maxRequests && performance.now() - startTime < maxDuration) {
    const t0 = performance.now();
    const req = new Request(url, {
      method,
      headers: options.headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    await scope.handle(req);
    const t1 = performance.now();
    latencies.push(t1 - t0);
    count++;
  }

  const totalDuration = performance.now() - startTime;
  latencies.sort((a, b) => a - b);

  const min = latencies[0] || 0;
  const max = latencies[latencies.length - 1] || 0;
  const sum = latencies.reduce((acc, v) => acc + v, 0);
  const mean = latencies.length > 0 ? sum / latencies.length : 0;
  const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;

  const mem = process.memoryUsage();

  return {
    path,
    method,
    totalRequests: count,
    durationMs: Math.round(totalDuration * 100) / 100,
    requestsPerSecond: Math.round((count / (totalDuration / 1000)) * 10) / 10,
    latency: {
      min: Math.round(min * 1000) / 1000,
      max: Math.round(max * 1000) / 1000,
      mean: Math.round(mean * 1000) / 1000,
      p50: Math.round(p50 * 1000) / 1000,
      p95: Math.round(p95 * 1000) / 1000,
      p99: Math.round(p99 * 1000) / 1000
    },
    memory: {
      heapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
      rssMb: Math.round((mem.rss / 1024 / 1024) * 100) / 100
    }
  };
}

export function formatBenchmarkMarkdown(res: BenchmarkResult): string {
  return `### APEX14 Route Benchmark: \`${res.method} ${res.path}\`

| Metric | Measured Value |
| :--- | :--- |
| **Throughput** | **${res.requestsPerSecond.toLocaleString()} req/sec** |
| **Total Requests** | ${res.totalRequests} requests (${res.durationMs}ms) |
| **p50 (Median Latency)** | **${res.latency.p50} ms** |
| **p95 Latency** | ${res.latency.p95} ms |
| **p99 Latency** | ${res.latency.p99} ms |
| **Min / Max Latency** | ${res.latency.min} ms / ${res.latency.max} ms |
| **Memory (Heap / RSS)** | ${res.memory.heapUsedMb} MB / ${res.memory.rssMb} MB |
`;
}
