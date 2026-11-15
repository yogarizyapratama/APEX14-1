# APEX14 Official Documentation

Welcome to the complete official documentation for **APEX14 — The Intelligent API Framework**.

---

## Documentation Sections

1. [**Getting Started**](file:///Users/mac/Documents/YOGA/YOGA%20GOKS/APEX14/docs/getting-started.md)
   - Installation, Quick Start, First API in 10 seconds, CLI tooling.

2. [**Direct Function API & Architecture**](file:///Users/mac/Documents/YOGA/YOGA%20GOKS/APEX14/docs/direct-function-api.md)
   - Zero-Instance DX, Core functions, Auto-serialization, Route groups, Context isolation.

3. [**Zero-Query Model & Full ORM Engine**](file:///Users/mac/Documents/YOGA/YOGA%20GOKS/APEX14/docs/database-and-orm.md)
   - Zero raw queries, automated table generation from schemas, `model()`, fluent query builder (`db("users")`), `findMany`, `create`, `update`, `delete`, soft deletes, timestamps, and transactions.

4. [**TypeBox Validation & Contracts**](file:///Users/mac/Documents/YOGA/YOGA%20GOKS/APEX14/docs/validation-and-contracts.md)
   - End-to-end type safety, TypeBox schema definitions, static type inference, formatted error messages.

5. [**Enterprise Security & Auth**](file:///Users/mac/Documents/YOGA/YOGA%20GOKS/APEX14/docs/security-and-auth.md)
   - WebCrypto JWT, Scrypt password hashing, sliding-window rate limiting, SSRF guard, security headers, CORS.

6. [**Safe Storage & File Management**](file:///Users/mac/Documents/YOGA/YOGA%20GOKS/APEX14/docs/storage-and-files.md)
   - Single/multiple uploads, magic-byte file signature validation, path traversal defense, downloads.

7. [**CRUD Resource Engine**](file:///Users/mac/Documents/YOGA/YOGA%20GOKS/APEX14/docs/resource-crud-engine.md)
   - Zero-boilerplate 5-endpoint REST generator with `resource()`, pagination, allowlists, soft deletes.

8. [**Multi-Runtime & Deployment**](file:///Users/mac/Documents/YOGA/YOGA%20GOKS/APEX14/docs/multi-runtime-and-deployment.md)
   - Node.js & Bun runtime adapters, Dockerfile, serverless export, graceful shutdown.

9. [**Real-Time Primitives: SSE & WebSockets**](file:///Users/mac/Documents/YOGA/YOGA%20GOKS/APEX14/docs/realtime-sse-websocket.md)
   - `sse()` async generator event streaming and `ws()` Direct Function WebSockets with room broadcasting.

10. [**Background Tasks & In-Memory Scheduler**](file:///Users/mac/Documents/YOGA/YOGA%20GOKS/APEX14/docs/tasks-and-scheduler.md)
    - Zero-dependency task queues with `task()` and recurring jobs with `schedule()`.

11. [**OpenAPI 3.1 & Interactive Docs Playground**](file:///Users/mac/Documents/YOGA/YOGA%20GOKS/APEX14/docs/openapi-and-docs.md)
    - Zero-config Scalar API documentation and interactive testing console on `/_docs`.

12. [**Native AI & MCP (Model Context Protocol) Bridge**](file:///Users/mac/Documents/YOGA/YOGA%20GOKS/APEX14/docs/ai-and-mcp.md)
    - Auto-export REST routes into native AI Agent tools on `/mcp`.

13. [**End-to-End Type-Safe Client (`@apex14/client`)**](file:///Users/mac/Documents/YOGA/YOGA%20GOKS/APEX14/docs/type-safe-client.md)
    - Frontend proxy RPC client with full TypeScript autocomplete.

14. [**Embedded Developer Studio (`/_studio`)**](file:///Users/mac/Documents/YOGA/YOGA%20GOKS/APEX14/docs/studio-and-diagnostics.md)
    - Visual data explorer, route registry, task queue inspector, and runtime metrics dashboard.

15. [**Native Resilience & Circuit Breaker (`resilient()`)**](file:///Users/mac/Documents/YOGA/YOGA%20GOKS/APEX14/docs/resilience-and-circuit-breaker.md)
    - Exponential backoff retries, timeouts, and canary circuit breaker.

16. [**Multi-Tier Caching & SWR (`cache`)**](file:///Users/mac/Documents/YOGA/YOGA%20GOKS/APEX14/docs/caching-and-swr.md)
    - In-memory LRU cache, route option caching, stale-while-revalidate, and tag invalidation.

17. [**Native Webhook Engine & Idempotency (`webhook()`)**](file:///Users/mac/Documents/YOGA/YOGA%20GOKS/APEX14/docs/webhooks-and-idempotency.md)
    - Stripe/GitHub HMAC signature verification and deduplicated idempotent delivery.

18. [**Universal Edge & Serverless (`toFetch()`)**](file:///Users/mac/Documents/YOGA/YOGA%20GOKS/APEX14/docs/edge-and-serverless.md)
    - Universal web standard fetch handler for Cloudflare Workers, Vercel Edge, and Deno.

19. [**Direct Auth & Session Engine (`auth`)**](file:///Users/mac/Documents/YOGA/YOGA%20GOKS/APEX14/docs/auth-and-sessions.md)
    - Zero-boilerplate session engine, auto-mounted login/register/logout/me routes, and role-based guards.

20. [**Durable Step Functions & Distributed Saga Workflows (`workflow`)**](file:///Users/mac/Documents/YOGA/YOGA%20GOKS/APEX14/docs/workflows-and-sagas.md)
    - Zero-DevOps durable execution, memoized steps, durable sleep, and automatic saga compensation rollbacks.

21. [**Reactive Live Queries & Real-Time Sync (`live`)**](file:///Users/mac/Documents/YOGA/YOGA%20GOKS/APEX14/docs/reactive-live-queries.md)
    - Query-level reactive SSE streaming with automated database model mutation detection.

22. [**Incident Replay & Self-Healing Telemetry (`heal`)**](file:///Users/mac/Documents/YOGA/YOGA%20GOKS/APEX14/docs/self-healing-and-replays.md)
    - Automated crash capture, sanitized state snapshots, AI diagnosis prompt generation, and Studio replay lab.

23. [**Type-Safe Dual-Mode Contract SDK (`contract`)**](file:///Users/mac/Documents/YOGA/YOGA%20GOKS/APEX14/docs/contracts-and-dual-sdk.md)
    - Single contract schema driving TypeBox runtime validation, OpenAPI 3.1, MCP tools, and frontend RPC client.

24. [**Micro-Benchmarking & Performance Verification (`apex14 benchmark`)**](file:///Users/mac/Documents/YOGA/YOGA%20GOKS/APEX14/docs/benchmarking.md)
    - Built-in CLI micro-benchmark command measuring latency percentiles (p50, p95, p99), RPS, and memory footprint.
