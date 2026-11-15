# APEX14 Implementation Plan — The Intelligent API Framework

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Design, implement, test, document, and package APEX14 — a next-generation TypeScript API framework featuring a Direct Function API, zero-instance DX, multi-runtime architecture, end-to-end type safety, built-in security, and enterprise capabilities.

**Architecture:** Monorepo using pnpm workspaces and Turborepo. Core portable engine based on Web Standards (`Request`/`Response`/Streams), high-performance radix-tree router, isolated AsyncLocalStorage-backed registration/execution contexts for the Direct Function API (`route`, `group`, `use`, `secure`, `run`), modular packages for validation (TypeBox), security (JWT, Argon2/crypto, rate limit, SSRF guard, secure headers, CORS), storage (local and S3-compatible), database abstraction (SQLite/Postgres/MySQL/MongoDB interfaces), multi-runtime adapters (Node.js & Bun), CLI developer tooling, and comprehensive documentation.

**Tech Stack:** TypeScript (strict ESM), pnpm workspaces, Vitest, Node.js v24+, Bun, @sinclair/typebox, Web Standards.

**Spec:** Section 1 through Section 44 of the APEX14 Master Build Prompt.

---

## Global Constraints

- Never require an application instance in normal application code: `import { route, run } from "apex14"` (No `app = new Apex()`, no `app.get()`, no `app.listen()`).
- Direct return values: objects/arrays auto-serialized to JSON, strings to text, Streams/Responses passed through.
- Context isolation: Default global registry for zero-instance DX, coupled with scoped AsyncLocalStorage and `createScope()` for concurrent, isolated testing and serverless instances without accidental cross-leakage.
- Security by default: Safe parameterization, timing-safe crypto, magic-byte file signature validation, path traversal defense, SSRF private IP blocking, secure headers, CORS whitelist requirement.
- Multi-runtime portability: Portable core relying on Web Standards; runtime adapters for Node.js (`node:http`) and Bun (`Bun.serve`).
- Zero fake features or placeholder mocks: Every implemented command and function must be real, tested, and documented.

---

## Review Focus

1. **Direct Function API & Context Isolation:** Parallel tests or concurrent contexts must not cross-contaminate route registries or middleware pipelines.
2. **Return Value Auto-Serialization:** Returning numbers, booleans, objects, arrays, null, strings, promises, streams, and raw `Response` instances must adhere strictly to content-type and status contracts without calling response wrappers.
3. **Route Method & Param Matching:** Radix tree matching must properly resolve dynamic segments (`:id`), wildcards (`*`), method maps (`{ GET: ..., POST: ... }`), and nested group prefixes.
4. **Security Engine Rigor:** JWT claim validation (exp, nbf, iss, aud), algorithm enforcement (prevent `none` or mismatched algo), rate limiter sliding window accuracy, SSRF private IP detection.
5. **File Upload & Storage Security:** Path traversal protection, file signature (magic byte) detection, size bounds with backpressure streaming.

---

## Tasks

### Task 1: Monorepo Foundation & Tooling Configuration
- [ ] Initialize root `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `turbo.json`, and `.gitignore`.
- [ ] Configure Vitest root config for workspace-wide testing.
- [ ] Initialize documentation and status tracker files: `IMPLEMENTATION_STATUS.md`, `ROADMAP.md`, `KNOWN_LIMITATIONS.md`, `RELEASE_CHECKLIST.md`.

### Task 2: Core HTTP Engine & Radix-Tree Router (`@apex14/router`, `@apex14/core`)
- [ ] Implement `@apex14/router`: Radix-tree trie with support for static routes, parameterized segments (`:param`), wildcards (`*`), HTTP method dispatching, and nested route prefixes.
- [ ] Write router unit tests covering edge cases (overlapping routes, param precedence, wildcards, trailing slashes).
- [ ] Implement `@apex14/core` context & registration architecture:
  - `ApexContext` / `ApexRegistry` supporting route definitions, global middleware, lifecycle hooks, and error handling.
  - `AsyncLocalStorage` and `createScope()` for concurrent context isolation.
  - Direct function exports: `route()`, `group()`, `use()`, `guard()`, `secure()`, `inject()`, `createScope()`.
  - Auto-serialization pipeline for strings, JSON objects/arrays, booleans, numbers, null, streams, and native `Response`.
- [ ] Write core tests validating zero-instance registration, route group nesting, middleware order, and direct return serialization.

### Task 3: Universal Request Context & HTTP Layer (`@apex14/http`)
- [ ] Implement `@apex14/http`:
  - Strongly-typed `ApexRequestContext`: `params`, `query`, `headers`, `cookies`, `body`, `user`, `ip`, `url`, `signal`, `state`.
  - Body parsers (JSON, form-urlencoded, text, multipart metadata).
  - Cookie parser and signed cookie manager.
  - Error hierarchy: `ApexError`, `ValidationError`, `AuthenticationError`, `AuthorizationError`, `NotFoundError`, `RateLimitError`.
- [ ] Write HTTP layer tests verifying parameter extraction, cookie signing, body parsing, and error formatting.

### Task 4: Type Safety & Validation Engine (`@apex14/validation`)
- [ ] Implement `@apex14/validation` based on TypeBox (`@sinclair/typebox`):
  - Type-safe schema validator for route `body`, `query`, `params`, `headers`, `response`.
  - Type inference utilities (`Static<T>`).
  - Standardized validation error formatting with field paths and messages.
- [ ] Write validation tests for valid/invalid payloads, type coercion control, and schema integration with `route()`.

### Task 5: Security Engine (`@apex14/security`)
- [ ] Implement JWT module:
  - Token signing & verification with HS256, RS256, ES256 using standard WebCrypto.
  - Claims validation: `exp`, `nbf`, `iat`, `iss`, `aud`.
  - Key rotation and token header inspection.
- [ ] Implement Password Hashing:
  - Secure scrypt / timingSafeEqual hashing & verification with salt and work factors.
- [ ] Implement Rate Limiter:
  - Sliding-window in-memory rate limiter with configurable limits by IP, user, or token.
- [ ] Implement HTTP Security & CORS:
  - Security headers (HSTS, CSP, X-Frame-Options, Referrer-Policy, X-Content-Type-Options).
  - CORS middleware with strict allowlist and preflight handling.
- [ ] Implement SSRF Protection:
  - URL inspection, DNS resolution check, private CIDR filtering (IPv4/IPv6).
- [ ] Write security tests for JWT tamper detection, rate limit window enforcement, CORS preflights, and SSRF blocking.

### Task 6: File Management Engine (`@apex14/storage`)
- [ ] Implement storage abstractions and local filesystem provider.
- [ ] Implement safe file operations: `file.save`, `file.saveMany`, `file.download`, `file.info`, `file.delete`.
- [ ] Implement file security:
  - Random key generation, path traversal sanitation.
  - Magic byte / file signature inspector (JPEG, PNG, GIF, PDF, ZIP, WebP).
  - File size and MIME type verification.
- [ ] Write storage unit tests verifying upload sanitization, path traversal rejection, and signature detection.

### Task 7: Database Engine & Resource Engine (`@apex14/database`)
- [ ] Implement unified database abstraction `db(name)`:
  - Connection management, parameterized queries, health checks.
  - Embedded SQLite adapter (zero external dependencies).
  - Pluggable provider contracts for PostgreSQL, MySQL, and MongoDB.
- [ ] Implement CRUD `resource()` generator:
  - Automated route creation for `list`, `read`, `create`, `update`, `delete`.
  - Pagination, field allowlists, and authorization guards.
- [ ] Write database & resource tests for SQLite transactions, parameterized queries, and CRUD operations.

### Task 8: Multi-Runtime Adapters (`@apex14/runtime-node`, `@apex14/runtime-bun`)
- [ ] Implement Node.js runtime adapter (`node:http` to standard Web `Request`/`Response`).
- [ ] Implement Bun runtime adapter (`Bun.serve` bridge).
- [ ] Implement universal `run()` launcher:
  - Detects runtime automatically (Bun vs Node.js).
  - Starts server on specified port/host or configuration.
  - Graceful shutdown handling (`SIGINT`, `SIGTERM`).
- [ ] Provide `testRequest` / `fetch` programmatic runner for zero-port testing and serverless handlers.
- [ ] Write runtime tests confirming HTTP request/response flow in Node.js.

### Task 9: The Umbrella Package (`apex14`)
- [ ] Wire all sub-packages into the root `apex14` package.
- [ ] Re-export Direct Function API:
  `route`, `group`, `use`, `guard`, `secure`, `run`, `Type`, `file`, `db`, `resource`, `createScope`, `testRequest`.
- [ ] Provide clean package.json exports (`.`, `./security`, `./storage`, `./database`, `./validation`).
- [ ] Write end-to-end integration tests using the exact developer experience specified in Section 39.

### Task 10: CLI & Project Generator (`@apex14/cli`, `create-apex14`)
- [ ] Implement `@apex14/cli`:
  - `apex14 --help`, `apex14 --version`
  - `apex14 create <app>`
  - `apex14 routes`: lists all registered routes in tabular format
  - `apex14 doctor`: checks node version, tsconfig, environment, and security configurations
  - `apex14 generate [route|middleware|schema]`
  - `apex14 dev`, `apex14 start`, `apex14 build`
- [ ] Implement `create-apex14` scaffolding package with `minimal` and `professional` templates.
- [ ] Write CLI tests for route listing, doctor diagnostic, and project generation.

### Task 11: Real-World Examples, Benchmarks & Documentation
- [ ] Create `examples/minimal`: Zero-instance starter with `route("/", () => "Hello APEX14")`.
- [ ] Create `examples/rest-api`: Full REST API with JWT auth, user CRUD, file upload, and validation.
- [ ] Implement honest, reproducible router & HTTP benchmark suite (`benchmarks/`).
- [ ] Create comprehensive root `README.md`, `LICENSE` (MIT), `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`.
- [ ] Finalize `IMPLEMENTATION_STATUS.md`, `ROADMAP.md`, `KNOWN_LIMITATIONS.md`, and `RELEASE_CHECKLIST.md`.
