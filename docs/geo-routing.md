# Multi-Region Geo-Routing & Replica Steering (`geo`)

APEX14 features direct geographic awareness, allowing applications to steer incoming traffic to regional read-replicas, CDNs, or localized handlers without cross-continental network latency.

---

## 1. Quick Example

```ts
import { route, geo } from "apex14";

route("/catalog", {
  GET: geo.steer({
    regions: {
      // Asian clients (e.g. ID, SG, JP, KR) routed to Tokyo/Singapore replica
      asia: () => TokyoReplica.getCatalog(),

      // European clients (e.g. DE, GB, FR, NL) routed to Frankfurt replica
      europe: () => FrankfurtReplica.getCatalog(),

      // Specific country override (e.g. Indonesia)
      id: () => JakartaEdge.getCatalog(),

      // American clients
      americas: () => VirginiaPrimary.getCatalog()
    },
    fallback: () => VirginiaPrimary.getCatalog()
  })
});
```

---

## 2. Supported Detection Headers

`geo` automatically inspects:
- `cf-ipcountry` (Cloudflare)
- `x-vercel-ip-country` (Vercel)
- `x-region` / `x-geo-region` (Custom proxies / AWS ALB)
- `x-country-code`

---

## 3. Direct Location Queries

```ts
import { geo, route } from "apex14";

route("/user-region", (ctx) => {
  return {
    country: geo.getCountry(ctx),
    region: geo.getRegion(ctx)
  };
});
```
