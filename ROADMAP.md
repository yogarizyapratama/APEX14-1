# APEX14 — Development Roadmap

---

## Phase 1 — Foundation (Active)
- Monorepo workspace configuration (`pnpm-workspace.yaml`, `tsconfig.base.json`, `turbo.json`).
- Core architecture design: Zero-instance Direct Function API, execution scopes, context isolation.
- Fast Radix-tree router (`@apex14/router`).
- Universal Request Context and auto-serialization HTTP engine (`@apex14/http`, `@apex14/core`).

## Phase 2 — Type Safety & Validation
- Validation engine (`@apex14/validation`) using TypeBox schemas.
- Route request/response schema integration with automatic TypeScript inference.
- Validation error formatting with path pointers.

## Phase 3 — Enterprise Security Engine
- Pure WebCrypto JWT module (`@apex14/security`) with claim enforcement and key rotation.
- Secure password hashing with salt and timing-safe checks.
- Sliding-window rate limiter with flexible keying.
- SSRF guard with private CIDR blocking and DNS check.
- Production security headers and CORS protection.

## Phase 4 — File Management & Storage
- Storage engine (`@apex14/storage`) with local and S3-compatible adapters.
- Safe upload handling, path traversal protection, file signature (magic byte) detection.
- Streaming uploads/downloads with backpressure.

## Phase 5 — Database & CRUD Resource Engine
- Database abstraction layer (`@apex14/database`) with embedded SQLite support.
- Automated `resource()` CRUD endpoint generator with pagination, allowlists, and guards.

## Phase 6 — Multi-Runtime Adapters & Direct DX
- Node.js runtime adapter (`@apex14/runtime-node`).
- Bun runtime adapter (`@apex14/runtime-bun`).
- Umbrella package (`apex14`) delivering the Zero-Instance Direct Function API.
- Programmatic testing runner (`testRequest`) for parallel in-memory testing.

## Phase 7 — Developer Tooling (CLI & Scaffolding)
- CLI (`@apex14/cli`): `routes`, `doctor`, `generate`, `dev`, `build`, `start`.
- Scaffolding tool (`create-apex14`) with minimal and professional templates.

## Phase 8 — Examples, Benchmarking & Documentation
- Runnable examples: `examples/minimal` and `examples/rest-api`.
- Router performance benchmark suite (`benchmarks/`).
- Full open-source documentation (`README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `LICENSE`).
- Release readiness verification.
