# APEX14 — Known Limitations

This document tracks current constraints, deliberate trade-offs, and unsupported capabilities in the initial v0.1 release of APEX14.

---

## 1. Multi-Runtime Support
- **Node.js**: Fully supported on Node v20+. Uses `node:http` and Web Standard `Request`/`Response`.
- **Bun**: Supported via native `Bun.serve`.
- **Deno**: Deno compatibility is supported through Web Standard `Request`/`Response` interfaces, but dedicated CLI bundling is targeted for Phase 10.
- **Cloudflare Workers / V8 isolates**: In-memory routing and `createScope().handle(req)` is Web Standards compliant, but edge cache adapters are planned for future versions.

## 2. Database Providers
- **SQLite**: Fully embedded zero-dependency SQLite adapter available out of the box.
- **PostgreSQL / MySQL / MongoDB**: Provider interfaces and query normalization contracts are defined; external driver integrations (e.g. pg, mysql2, mongodb) connect through standard adapter hooks.

## 3. Realtime Capabilities
- WebSockets and Server-Sent Events (SSE) interfaces are established; multi-node Redis pub/sub broker backends are scheduled for post-v1.

## 4. File Management
- Local filesystem storage adapter is fully functional with magic byte inspection and path traversal prevention.
- S3-compatible cloud storage adapter implements standard AWS S3 REST signatures. External cloud credentials require environment setup (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_BUCKET`).
