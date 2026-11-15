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

25. [**Autonomous AI Agent Runtime (`agent`)**](file:///Users/mac/Documents/YOGA/YOGA%20GOKS/APEX14/docs/ai-agent-runtime.md)
    - Zero-dependency AI agent runtime, automatic task-to-tool reflection, and SSE stream handling.

26. [**Kernel-Level Row-Level Multi-Tenancy (`tenant`)**](file:///Users/mac/Documents/YOGA/YOGA%20GOKS/APEX14/docs/multi-tenancy.md)
    - Transparent tenant resolution and automatic database model query scoping without manual filters.

27. [**Temporal Time-Travel Data Auditing (`audit`)**](file:///Users/mac/Documents/YOGA/YOGA%20GOKS/APEX14/docs/audit-and-time-travel.md)
    - Change data capture, audit history diffs, and temporal `asOf()` time-travel historical state reconstruction.

28. [**Event Sourcing & Transactional Outbox Engine (`event`)**](file:///Users/mac/Documents/YOGA/YOGA%20GOKS/APEX14/docs/event-sourcing-outbox.md)
    - Guaranteed at-least-once message delivery with transactional outbox queue and decoupled event subscribers.

29. [**Native Chaos Engineering Simulator (`chaos`)**](file:///Users/mac/Documents/YOGA/YOGA%20GOKS/APEX14/docs/chaos-engineering.md)
    - Programmatic fault injection, latency jitter, and failure rate testing directly in the framework.

30. [**Multi-Region Geo-Routing & Replica Steering (`geo`)**](file:///Users/mac/Documents/YOGA/YOGA%20GOKS/APEX14/docs/geo-routing.md)
    - Dynamic geo-steering routing traffic to regional database read-replicas and nearest edge datacenters.

31. [**Native Distributed Locks & Atomic Mutex (`lock`)**](file:///Users/mac/Documents/YOGA/YOGA%20GOKS/APEX14/docs/distributed-locks.md)
    - Concurrency serialization, race condition defense, and deadlock-safe auto-releasing mutexes.

32. [**Tiered Rate Limiting & Token Cluster (`throttle`)**](file:///Users/mac/Documents/YOGA/YOGA%20GOKS/APEX14/docs/tiered-throttling.md)
    - Multi-tenant token bucket rate limiter with cost weighting, dynamic tier resolution, and standard headers.

33. [**Cryptographic Request Attestation (`verify`)**](file:///Users/mac/Documents/YOGA/YOGA%20GOKS/APEX14/docs/cryptographic-verification.md)
    - Constant-time HMAC-SHA256 request signing, payload hash verification, and anti-replay timestamp drift defense.

34. [**Schema-Driven Synthetic Mock Engine (`mock`)**](file:///Users/mac/Documents/YOGA/YOGA%20GOKS/APEX14/docs/synthetic-mock-engine.md)
    - TypeBox contract-driven synthetic data generation with seeded PRNG, field heuristics, and instant mock route handlers.

35. [**Dynamic Zero-Downtime Hot-Patching (`patch`)**](file:///Users/mac/Documents/YOGA/YOGA%20GOKS/APEX14/docs/zero-downtime-hotpatching.md)
    - In-memory live route replacement without server restarts, breaking WebSockets, or connection drops, plus instant rollback.

36. [**Native WebAssembly Isolated Sandbox (`wasm`)**](file:///Users/mac/Documents/YOGA/YOGA%20GOKS/APEX14/docs/wasm-sandboxing.md)
    - Secure W3C WebAssembly runner with memory bounding, timeout deadlines, and safe guest execution across all runtimes.

37. [**RFC 6902 JSON Patch & Incremental Sync (`delta`)**](file:///Users/mac/Documents/YOGA/YOGA%20GOKS/APEX14/docs/delta-patching.md)
    - Minimal object/array diff computation, atomic patch application, and standard HTTP PATCH route handler wrapper.

38. [**Attribute-Based Access Control (ABAC) Engine (`policy`)**](file:///Users/mac/Documents/YOGA/YOGA%20GOKS/APEX14/docs/abac-policy-engine.md)
    - Fine-grained declarative policy authorization based on user attributes, resource state, and runtime context.

39. [**Zero-Memory Backpressured Transform & ETL Pipeline (`stream`)**](file:///Users/mac/Documents/YOGA/YOGA%20GOKS/APEX14/docs/streaming-etl-pipeline.md)
    - Lazy backpressured streaming pipeline for massive datasets with streaming NDJSON and CSV responses.

40. [**Deterministic Time-Warp Flight Recorder (`replay`)**](file:///Users/mac/Documents/YOGA/YOGA%20GOKS/APEX14/docs/flight-recorder-replay.md)
    - Full in-flight request, response, and error capture into replay cassettes for 100% deterministic local debugging.

41. [**Semantic Contract Regression & Golden-Master Engine (`snapshot`)**](file:///Users/mac/Documents/YOGA/YOGA%20GOKS/APEX14/docs/semantic-snapshot-testing.md)
    - Anti-brittle snapshot testing with automatic semantic masking of dynamic timestamps and UUIDs with path-level diffs.

42. [**Zero-Config Polyglot Client SDK Generator (`sdk`)**](file:///Users/mac/Documents/YOGA/YOGA%20GOKS/APEX14/docs/polyglot-sdk-generator.md)
    - Automated in-memory code generation of idiomatic, zero-dependency client SDKs for TypeScript, Python, Dart, and Go.

43. [**Embedded Vector Similarity & Semantic Search (`vector`)**](file:///Users/mac/Documents/YOGA/YOGA%20GOKS/APEX14/docs/embedded-vector-search.md)
    - Native in-memory vector index with Cosine, Dot, and Euclidean metrics, Top-K search, and metadata filtering.

44. [**Zero-Latency Dynamic Feature Flagging (`feature`)**](file:///Users/mac/Documents/YOGA/YOGA%20GOKS/APEX14/docs/canary-feature-flags.md)
    - Canary rollouts, deterministic FNV-1a sticky hashing, user/tenant targeting, and zero-overhead route gating.

45. [**Automated PII Redaction & Privacy Shield (`mask`)**](file:///Users/mac/Documents/YOGA/YOGA%20GOKS/APEX14/docs/pii-redaction-privacy-shield.md)
    - Automatic Luhn-validated credit card, email, phone, and SSN sanitization for GDPR/HIPAA compliance.

46. [**Native AI Prompt Injection Defense & Schema Healer (`guardrail`)**](file:///Users/mac/Documents/YOGA/YOGA%20GOKS/APEX14/docs/ai-guardrails-and-schema-healer.md)
    - Heuristic prompt injection / jailbreak firewall, Markdown JSON stripping, syntax repair, and TypeBox validation.

47. [**Declarative Zero-CLI Schema Migrator (`migrate`)**](file:///Users/mac/Documents/YOGA/YOGA%20GOKS/APEX14/docs/declarative-database-migrations.md)
    - Automated TypeBox schema diffing and safe SQL ALTER TABLE / CREATE TABLE generation at application boot.

48. [**Prometheus & OpenTelemetry APM Metrics Engine (`metric`)**](file:///Users/mac/Documents/YOGA/YOGA%20GOKS/APEX14/docs/prometheus-apm-metrics.md)
    - Real-time Counters, Gauges, Latency Histograms, and native standard `/_metrics` Prometheus text scrape endpoint.
