# APEX14 — Multi-Runtime & Production Deployment

APEX14 is designed to run seamlessly across JavaScript runtimes without leaking runtime-specific dependencies into the framework core.

---

## 1. Supported Runtimes

### Node.js (v20.0.0+)
- Adapts `node:http` and `node:https` to Web Standard `Request` and `Response`.
- Leverages native `node:sqlite` for embedded database support.
- Fully supports streaming backpressure and keep-alive connections.

### Bun (v1.0+)
- Uses native `Bun.serve({ fetch: (req) => scope.handle(req) })`.
- Delivers maximum throughput and sub-millisecond cold starts.

---

## 2. Universal Launcher (`run()`)

The `run()` function detects your active runtime automatically:

```ts
import { route, run } from "apex14";

route("/", () => ({ status: "online" }));

// Automatically starts Bun.serve in Bun, or http.createServer in Node.js
run({
  port: parseInt(process.env.PORT || "3000", 10),
  host: "0.0.0.0"
});
```

---

## 3. Serverless & Edge Handler

When deploying to serverless platforms (e.g. AWS Lambda with Web Adapter, Vercel Functions, Cloudflare Workers):

```ts
import { route, handle } from "apex14";

route("/api/hello", () => "Hello from Serverless!");

// Export standard fetch handler
export default {
  fetch(request: Request): Promise<Response> {
    return handle(request);
  }
};
```

---

## 4. Production Dockerfile

```dockerfile
FROM node:22-alpine AS builder

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

---

## 5. Graceful Shutdown

APEX14 automatically handles `SIGINT` and `SIGTERM` signals:
- Stops accepting new incoming connections.
- Allows in-flight requests to complete cleanly before process exit.
- Closes database connection pools and flushes background rate-limiting buffers.
