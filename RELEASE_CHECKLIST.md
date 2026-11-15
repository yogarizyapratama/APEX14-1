# APEX14 — Release Checklist

Pre-release validation checklist for public distribution on npm and GitHub.

---

## 1. Quality & Verification Gates
- [x] TypeScript strict mode (`tsconfig.base.json`) passes with 0 errors across all packages.
- [x] Vitest test suite passes with 100% green tests (60/60 passing).
- [x] No placeholder mocks or fake implementations.
- [x] Context isolation verified: parallel test execution without cross-contamination.
- [x] Return value serialization tested for all supported primitives and streams.

## 2. Security Validation
- [x] JWT tokens tested for tamper resistance, signature mismatch, expired claims, and algorithm allowlist.
- [x] SSRF defense tested against IPv4 and IPv6 private/reserved ranges (10.x, 127.x, 169.254.x, ::1).
- [x] File uploads sanitized against path traversal (`../`) and file signature spoofing.
- [x] Rate limiting verified under burst and window expiration scenarios.
- [x] Timing-safe comparison enforced for password hash and signature verification.

## 3. Package & Monorepo Integrity
- [x] Monorepo workspace builds cleanly using `pnpm build`.
- [x] Package exports (`exports` field in `package.json`) verified for ESM and TypeScript definitions (`types`).
- [x] No circular package dependencies.
- [x] Clean external dependency footprint (TypeBox as primary validation dependency; native WebCrypto, node:crypto, and node:sqlite leveraged).

## 4. Documentation & Open-Source Readiness
- [x] Top-level `README.md` with Direct Function API examples, benchmarks, and architecture overview.
- [x] `LICENSE` (MIT) present.
- [x] `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md` in root.
- [x] Fully runnable examples in `examples/minimal` and `examples/rest-api`.
- [x] CLI commands documented and verified (`apex14 routes`, `apex14 doctor`, `apex14 create`).
