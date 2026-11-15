# Micro-Benchmarking & Performance Verification (`apex14 benchmark`)

APEX14 includes a built-in micro-benchmarking engine to measure and transparently verify route throughput (RPS), percentile latency ($p50, p95, p99$), and memory footprint on your exact hardware.

---

## 1. CLI Usage

Run a micro-benchmark directly from the command line:

```bash
# Benchmark the root endpoint with 500 requests
npx apex14 benchmark /

# Custom duration and request count
npx apex14 benchmark /users --duration 2000 --requests 1000

# Output as JSON for CI/CD pipelines
npx apex14 benchmark /health --json
```

---

## 2. Programmatic Usage

```ts
import { benchmarkRoute, formatBenchmarkMarkdown } from "@apex14/cli";
import { getActiveScope } from "apex14";

const results = await benchmarkRoute(getActiveScope(), "/api/items", {
  requests: 1000,
  durationMs: 2000,
  method: "GET"
});

console.log(formatBenchmarkMarkdown(results));
```

### Sample Output

```markdown
### APEX14 Route Benchmark: `GET /api/items`

| Metric | Measured Value |
| :--- | :--- |
| **Throughput** | **45,210 req/sec** |
| **Total Requests** | 1,000 requests (22.12ms) |
| **p50 (Median Latency)** | **0.018 ms** |
| **p95 Latency** | 0.035 ms |
| **p99 Latency** | 0.071 ms |
| **Min / Max Latency** | 0.012 ms / 0.154 ms |
| **Memory (Heap / RSS)** | 28.4 MB / 64.2 MB |
```
