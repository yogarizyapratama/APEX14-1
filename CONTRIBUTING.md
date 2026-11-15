# Contributing to APEX14

Thank you for your interest in contributing to APEX14!

## Core Principles

1. **No mandatory application instance:** The Direct Function API (`route`, `group`, `use`, `guard`, `run`) is non-negotiable.
2. **Direct return values:** Return plain objects/arrays/primitives without mandatory `json()` or response wrappers.
3. **Strict type safety:** Zero unvalidated assertions or unnecessary `any`.
4. **Security by default:** Safe defaults across headers, file validation, SSRF checks, and timing attacks.
5. **Measurable performance:** Never fabricate claims. Provide reproducible benchmark scripts.

## Development Workflow

1. Fork and clone the repository.
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Run the test suite:
   ```bash
   pnpm test
   ```
4. Build all packages:
   ```bash
   pnpm build
   ```
5. Run router benchmarks:
   ```bash
   pnpm bench
   ```

## Pull Requests

- Every new feature or bug fix must include unit tests.
- Ensure all tests pass: `pnpm test`.
- Ensure TypeScript compiles cleanly: `pnpm check`.
