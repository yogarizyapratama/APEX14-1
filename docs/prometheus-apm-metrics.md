# Prometheus & OpenTelemetry APM Metrics Engine (`metric`)

Track application throughput, error rates, and p50/p95/p99 latency percentiles with zero external monitoring daemons or heavy npm dependencies.

---

## 1. Custom Counters, Gauges & Histograms

```ts
import { metric, route } from "apex14";

const orderCounter = metric.counter("orders_processed_total", "Total processed orders");
const activeUsers = metric.gauge("active_users_current", "Current active sessions");
const latencyHistogram = metric.histogram("order_processing_seconds", "Processing time in seconds");

route("/api/orders/checkout", async (ctx) => {
  const endTimer = latencyHistogram.startTimer();
  
  await processOrder(ctx.body);
  
  orderCounter.inc(1, { status: "success" });
  endTimer();

  return { status: "ok" };
});
```

---

## 2. Standard Prometheus Scrape Endpoint (`/_metrics`)

Mount the standard Prometheus text format exporter:

```ts
import { metric } from "apex14";

// Automatically exposes GET /_metrics for Prometheus / Grafana scraping
metric.enableMetrics();
```

### Export Format Example
```text
# HELP orders_processed_total Total processed orders
# TYPE orders_processed_total counter
orders_processed_total{status="success"} 142

# HELP order_processing_seconds Processing time in seconds
# TYPE order_processing_seconds histogram
order_processing_seconds_bucket{le="0.05"} 110
order_processing_seconds_bucket{le="0.1"} 135
order_processing_seconds_bucket{le="+Inf"} 142
order_processing_seconds_sum 8.42
order_processing_seconds_count 142
```
