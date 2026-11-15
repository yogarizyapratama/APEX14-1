# APEX14 — Embedded Developer Studio (`/_studio`)

APEX14 comes with a built-in, lightweight **Developer Studio GUI** accessible directly in your browser. No separate GUI applications (pgAdmin, DBeaver, Prisma Studio) required.

---

## 1. Enabling APEX14 Studio

Pass `studio: true` to `run()`:

```ts
import { run } from "apex14";

run({
  port: 3000,
  studio: true,
  studioPath: "/_studio" // Default: /_studio
});
```

Navigate to `http://localhost:3000/_studio` to open the visual dashboard.

---

## 2. Studio Features

### 📁 Data Explorer
- Browse all tables created by your `model()` definitions.
- View records in a responsive table grid.
- Inline row deletion with instant confirmation.
- Inspect timestamps and soft-deleted rows.

### 🛣️ Route Registry
- Live list of all registered endpoints across your application.
- Badges for HTTP methods (`GET`, `POST`, `PUT`, `DELETE`).
- View route metadata, summaries, active middlewares, and route guards.

### ⚡ Tasks & Job Queues
- Monitor all asynchronous background task queues defined with `task()`.
- Inspect scheduled cron jobs and interval patterns defined with `schedule()`.

### 📈 System Metrics
- Live runtime detection (Node.js version or Bun).
- Server uptime and memory heap usage.
