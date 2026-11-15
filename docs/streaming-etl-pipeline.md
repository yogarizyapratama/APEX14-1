# Zero-Memory Backpressured Transform & ETL Pipeline (`stream`)

Buffering massive JSON arrays or querying tens of thousands of database rows into memory leads to Out-Of-Memory (OOM) fatal process crashes. APEX14's `stream` primitive provides lazy, backpressured streaming transforms that stream directly into HTTP responses.

---

## 1. Streaming Database Query to NDJSON

Stream millions of rows with constant RAM footprint using standard chunked transfer encoding:

```ts
import { stream, route, db } from "apex14";

route("/api/exports/transactions.ndjson", () => {
  return stream.fromQuery(db("transactions").cursor())
    .filter((tx) => tx.status === "completed")
    .transform((tx) => ({
      id: tx.id,
      amount: tx.amount,
      maskedCard: "**** **** **** " + tx.cardLast4
    }))
    .toNdjson(); // Streams application/x-ndjson
});
```

---

## 2. Streaming to CSV

```ts
route("/api/exports/report.csv", () => {
  return stream.from(fetchMassiveDataset())
    .toCsv(["orderId", "customer", "total", "date"]); // Streams text/csv
});
```

---

## 3. Lazy Transformations & Batching

```ts
const pipeline = stream.from([1, 2, 3, 4, 5, 6])
  .filter((x) => x % 2 === 0)
  .transform((x) => x * 10)
  .batch(2);

const results = await pipeline.collect();
// [[20, 40], [60]]
```
