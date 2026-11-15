# APEX14 — Getting Started Guide

## 1. Introduction

**APEX14** is an intelligent, high-performance TypeScript API framework built from the ground up on the **Zero-Instance Direct Function API** paradigm.

### Core Philosophy
- **Less Code. More Intent.**
- No mandatory application instance (`new Apex()`, `app.get()`, `app.listen()`).
- No unnecessary response wrappers (`json()`, `send()`).
- Built-in type safety, enterprise security, and multi-runtime execution.

---

## 2. Installation & Quick Start

### Create a new project via CLI

```bash
# Using npx (npm)
npx create-apex14 my-api

# Using pnpm
pnpm create apex14 my-api

# Or using the APEX14 CLI with templates
npx apex14 create my-api --template professional
```

### Manual Installation

In an existing Node.js or Bun project with `"type": "module"` in `package.json`:

```bash
pnpm add apex14
```

---

## 3. Your First API in 10 Seconds

Create `src/index.ts`:

```ts
import { route, run } from "apex14";

// 1. Text route
route("/", () => "Hello from APEX14!");

// 2. Direct JSON return (auto-serialized without response wrappers)
route("/health", () => ({
  status: "healthy",
  uptime: process.uptime(),
  timestamp: new Date().toISOString()
}));

// 3. Dynamic route parameter
route("/greet/:name", ({ params }) => ({
  greeting: `Hello, ${params.name}!`
}));

// 4. Start the server
run(3000);
```

Run with Node.js or Bun:

```bash
# Node.js
node --watch src/index.ts

# Or Bun
bun --watch src/index.ts
```

Visit [http://localhost:3000/health](http://localhost:3000/health) — you will receive:

```json
{
  "status": "healthy",
  "uptime": 0.42,
  "timestamp": "2026-11-15T04:18:00.000Z"
}
```

---

## 4. APEX14 CLI Tooling

APEX14 includes developer tooling:

```bash
# Diagnostic environment health check
apex14 doctor

# Display tabular list of all registered routes
apex14 routes

# Code generators for routes, middleware, and schemas
apex14 generate route users
apex14 generate middleware timer
apex14 generate schema product

# Run dev server with hot reload
apex14 dev
```
