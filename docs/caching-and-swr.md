# APEX14 — Multi-Tier Caching & Stale-While-Revalidate (SWR)

APEX14 provides a high-performance in-memory cache engine with LRU eviction, TTL expiration, tag invalidation, and automated route caching.

---

## 1. Route Caching via Route Options

Cache expensive database queries or external API calls automatically:

```ts
import { route, cache, model, run } from "apex14";

const Product = model("products", ProductSchema);

// Cache GET response for 60 seconds with tag "products"
route("/trending-products", {
  GET: async () => Product.where("views", ">", 1000).limit(20).get()
}, {
  cache: {
    ttl: "60s",
    tags: ["products"],
    swr: true // Serve stale data while revalidating
  }
});

// Invalidate all cached data tagged with "products" upon mutation:
route("/products", {
  POST: async ({ body }) => {
    const created = await Product.create(body);
    cache.invalidate("products"); // Immediately purges cached product endpoints!
    return created;
  }
});

run(3000);
```

---

## 2. Direct Cache API Reference (`cache`)

```ts
import { cache } from "apex14";

// 1. Set key with TTL and tags
cache.set("user:101", userData, {
  ttl: "15m",
  tags: ["users", "org:5"]
});

// 2. Get key
const user = cache.get("user:101");

// 3. Invalidate by tag
const purgedCount = cache.invalidate("users");

// 4. Delete single key
cache.delete("user:101");

// 5. Clear all entries
cache.clear();
```
