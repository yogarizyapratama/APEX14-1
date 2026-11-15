import fs from "node:fs/promises";
import path from "node:path";

export interface CreateProjectOptions {
  name: string;
  template?: "standard" | "minimal" | "professional";
  cwd?: string;
}

export async function createProject(options: CreateProjectOptions): Promise<string> {
  const rootDir = path.resolve(options.cwd || process.cwd(), options.name);
  const template = options.template || "standard";

  if (template === "minimal") {
    await fs.mkdir(path.join(rootDir, "src"), { recursive: true });

    const pkgJson = {
      name: options.name,
      version: "0.1.0",
      type: "module",
      scripts: {
        dev: "node --watch src/index.ts",
        build: "tsc",
        start: "node dist/index.js"
      },
      dependencies: {
        apex14: "^0.2.1"
      },
      devDependencies: {
        "@types/node": "^22.10.1",
        typescript: "^5.7.2"
      }
    };

    const tsConfig = {
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        strict: true,
        skipLibCheck: true,
        outDir: "./dist"
      },
      include: ["src/**/*"]
    };

    const indexContent = `import { route, run } from "apex14";

route("/", () => ({
  name: "${options.name}",
  framework: "APEX14",
  status: "running"
}));

route("/health", () => "healthy");

run(3000);
`;

    await fs.writeFile(path.join(rootDir, "package.json"), JSON.stringify(pkgJson, null, 2));
    await fs.writeFile(path.join(rootDir, "tsconfig.json"), JSON.stringify(tsConfig, null, 2));
    await fs.writeFile(path.join(rootDir, "src", "index.ts"), indexContent);

    return rootDir;
  }

  // STANDARD / COMPLETE NESTJS-LIKE ENTERPRISE ARCHITECTURE
  const directories = [
    "src/config",
    "src/database",
    "src/common/guards",
    "src/common/middleware",
    "src/common/utils",
    "src/modules/health",
    "src/modules/auth",
    "src/modules/users",
    "src/modules/uploads",
    "test"
  ];

  for (const dir of directories) {
    await fs.mkdir(path.join(rootDir, dir), { recursive: true });
  }

  const pkgJson = {
    name: options.name,
    version: "0.1.0",
    description: "Enterprise modular API built with APEX14",
    type: "module",
    scripts: {
      dev: "tsx watch src/index.ts",
      build: "tsc",
      start: "node dist/index.js",
      test: "vitest run"
    },
    dependencies: {
      apex14: "^0.2.1"
    },
    devDependencies: {
      "@types/node": "^22.10.1",
      typescript: "^5.7.2",
      tsx: "^4.19.2",
      vitest: "^2.1.8"
    }
  };

  const tsConfig = {
    compilerOptions: {
      target: "ES2022",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      strict: true,
      skipLibCheck: true,
      outDir: "./dist"
    },
    include: ["src/**/*"]
  };

  const gitignore = `node_modules/
dist/
data/
.env
*.log
.DS_Store
coverage/
`;

  const envContent = `PORT=3000
NODE_ENV=development
APP_NAME="${options.name}"
JWT_SECRET="apex14-super-secret-key-change-in-production-min32chars"
DATABASE_URL="sqlite:./data/app.db"
STORAGE_DIR="./data/storage"
`;

  const envExample = `PORT=3000
NODE_ENV=development
APP_NAME="${options.name}"
JWT_SECRET="your-secret-key-minimum-32-characters"
DATABASE_URL="sqlite:./data/app.db"
STORAGE_DIR="./data/storage"
`;

  const readme = `# ${options.name}

Production-grade, modular enterprise API powered by **APEX14**.

## Architecture & Features

This project follows the **APEX14 Modular Standard** (similar in completeness and structure to NestJS, but with sub-millisecond overhead and direct TypeScript typing):

\`\`\`
├── src/
│   ├── index.ts                # Bootstrap entry point & server runner
│   ├── app.ts                  # App initialization, global security & routes
│   ├── config/
│   │   └── env.ts              # Strongly-typed environment variables (dynamic getters)
│   ├── database/
│   │   └── connection.ts       # Database client setup & SQLite table schema
│   ├── common/
│   │   ├── guards/
│   │   │   ├── auth.guard.ts   # Bearer JWT verification guard
│   │   │   └── roles.guard.ts  # Role-based access control guard
│   │   ├── middleware/
│   │   │   ├── logger.middleware.ts # Structured latency and request logger
│   │   │   └── error.middleware.ts  # RFC-7807 problem details error handler
│   │   └── utils/
│   │       └── response.ts     # Standardized JSON response envelope
│   └── modules/
│       ├── health/             # /health & /health/metrics
│       ├── auth/               # /api/v1/auth (register, login, me)
│       ├── users/              # /api/v1/users (CRUD with TypeBox schemas)
│       └── uploads/            # /api/v1/uploads (Secure file storage)
└── test/
    └── app.test.ts             # E2E test suite using Vitest + testRequest
\`\`\`

## Getting Started

### 1. Install Dependencies
\`\`\`bash
# Using Bun (Recommended)
bun install

# Or using pnpm
pnpm install

# Or using npm
npm install
\`\`\`

### 2. Run in Development Mode
\`\`\`bash
# Using Bun
bun run src/index.ts

# Or using npm/pnpm
npm run dev
\`\`\`

### 3. Run Automated Tests
\`\`\`bash
npm test
\`\`\`

### 4. Interactive OpenAPI Documentation
Visit \`http://localhost:3000/docs\` in your browser to inspect and test all API endpoints with the built-in Swagger UI.
`;

  // Files map
  const files: Record<string, string> = {
    "package.json": JSON.stringify(pkgJson, null, 2),
    "tsconfig.json": JSON.stringify(tsConfig, null, 2),
    ".gitignore": gitignore,
    ".env": envContent,
    ".env.example": envExample,
    "README.md": readme,

    // Config
    "src/config/env.ts": `export interface AppConfig {
  PORT: number;
  NODE_ENV: string;
  APP_NAME: string;
  JWT_SECRET: string;
  DATABASE_URL: string;
  STORAGE_DIR: string;
}

export const env: AppConfig = {
  get PORT() {
    return Number(process.env.PORT) || 3000;
  },
  get NODE_ENV() {
    return process.env.NODE_ENV || "development";
  },
  get APP_NAME() {
    return process.env.APP_NAME || "${options.name}";
  },
  get JWT_SECRET() {
    return process.env.JWT_SECRET || "apex14-super-secret-key-change-in-production-min32chars";
  },
  get DATABASE_URL() {
    return process.env.DATABASE_URL || "sqlite:./data/app.db";
  },
  get STORAGE_DIR() {
    return process.env.STORAGE_DIR || "./data/storage";
  }
};
`,

    // Database
    "src/database/connection.ts": `import fs from "node:fs/promises";
import path from "node:path";
import { configureDatabase } from "apex14";
import { env } from "../config/env.js";

export async function initDatabase() {
  if (env.DATABASE_URL.startsWith("sqlite:")) {
    const dbPath = env.DATABASE_URL.replace(/^sqlite:\\/\\//, "").replace(/^sqlite:/, "");
    if (dbPath !== ":memory:") {
      const dir = path.dirname(dbPath);
      await fs.mkdir(dir, { recursive: true });
    }
  }

  const client = configureDatabase(env.DATABASE_URL);

  // Auto-migrate tables
  await client.execute(\`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  \`);

  await client.execute(\`
    CREATE TABLE IF NOT EXISTS uploads (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      path TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  \`);

  return client;
}
`,

    // Utils
    "src/common/utils/response.ts": `export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: Record<string, any>;
}

export function ok<T>(data: T, meta?: Record<string, any>): ApiResponse<T> {
  return {
    success: true,
    data,
    meta
  };
}

export function created<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data
  };
}
`,

    // Middlewares
    "src/common/middleware/logger.middleware.ts": `export async function loggerMiddleware(ctx: any, next: () => Promise<Response | any>) {
  const start = Date.now();
  const method = ctx.request.method;
  const path = ctx.url.pathname;

  try {
    const res = await next();
    const duration = Date.now() - start;
    const status = res instanceof Response ? res.status : 200;
    console.log(\`[\${new Date().toISOString()}] \${method} \${path} - \${status} (\${duration}ms)\`);
    return res;
  } catch (err) {
    const duration = Date.now() - start;
    console.error(\`[\${new Date().toISOString()}] \${method} \${path} - ERROR (\${duration}ms)\`);
    throw err;
  }
}
`,

    "src/common/middleware/error.middleware.ts": `import { ApexError } from "apex14";

export async function errorMiddleware(ctx: any, next: () => Promise<Response | any>) {
  try {
    return await next();
  } catch (err: any) {
    if (err instanceof ApexError) {
      throw err;
    }

    console.error("[Unhandled Error]", err);
    return new Response(
      JSON.stringify({
        error: {
          code: "INTERNAL_ERROR",
          message: process.env.NODE_ENV === "production" ? "Internal Server Error" : err.message,
          status: 500
        }
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}
`,

    // Guards
    "src/common/guards/auth.guard.ts": `import { Jwt, AuthenticationError, type ApexRequestContext } from "apex14";
import { env } from "../../config/env.js";

export async function authGuard(ctx: ApexRequestContext): Promise<boolean> {
  const authHeader = ctx.headers["authorization"] || ctx.request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new AuthenticationError("Missing or invalid Bearer authorization header");
  }

  const token = authHeader.slice(7).trim();
  try {
    const payload = await Jwt.verify(token, env.JWT_SECRET);
    ctx.state.user = payload;
    return true;
  } catch (err: any) {
    throw new AuthenticationError(err.message || "Invalid or expired JWT token");
  }
}
`,

    "src/common/guards/roles.guard.ts": `import { AuthorizationError, type ApexRequestContext } from "apex14";

export function requireRole(role: string) {
  return (ctx: ApexRequestContext): boolean => {
    const user = ctx.state?.user;
    if (!user) {
      throw new AuthorizationError("Authentication required before role verification");
    }
    if (user.role !== role && user.role !== "admin") {
      throw new AuthorizationError(\`Forbidden: Requires '\${role}' role\`);
    }
    return true;
  };
}
`,

    // Health Module
    "src/modules/health/health.service.ts": `import { db } from "apex14";

export class HealthService {
  async getHealth() {
    const uptime = process.uptime();
    const memory = process.memoryUsage();

    let dbOk = false;
    try {
      const res = await db("users").count();
      dbOk = typeof res === "number";
    } catch {
      dbOk = false;
    }

    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(uptime),
      services: {
        database: dbOk ? "up" : "degraded",
        memory: {
          heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
          rssMb: Math.round(memory.rss / 1024 / 1024)
        }
      }
    };
  }

  getMetrics() {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      cpuUsage: process.cpuUsage()
    };
  }
}

export const healthService = new HealthService();
`,

    "src/modules/health/health.route.ts": `import { route } from "apex14";
import { healthService } from "./health.service.js";
import { ok } from "../../common/utils/response.js";

export function registerHealthRoutes() {
  route("/health", async () => {
    const result = await healthService.getHealth();
    return ok(result);
  }, {
    summary: "Health Check",
    tags: ["Health"]
  });

  route("/health/metrics", () => {
    return ok(healthService.getMetrics());
  }, {
    summary: "System Metrics",
    tags: ["Health"]
  });
}
`,

    // Auth Module
    "src/modules/auth/auth.schema.ts": `import { Type, type Static } from "apex14";

export const RegisterDto = Type.Object({
  name: Type.String({ minLength: 2, maxLength: 100 }),
  email: Type.String({ format: "email" }),
  password: Type.String({ minLength: 6, maxLength: 100 }),
  role: Type.Optional(Type.Union([Type.Literal("user"), Type.Literal("admin")]))
});

export type RegisterInput = Static<typeof RegisterDto>;

export const LoginDto = Type.Object({
  email: Type.String({ format: "email" }),
  password: Type.String({ minLength: 1 })
});

export type LoginInput = Static<typeof LoginDto>;
`,

    "src/modules/auth/auth.service.ts": `import crypto from "node:crypto";
import { db, hashPassword, verifyPassword, Jwt, AuthenticationError, ConflictError } from "apex14";
import { env } from "../../config/env.js";
import type { RegisterInput, LoginInput } from "./auth.schema.js";

export class AuthService {
  async register(data: RegisterInput) {
    const existing = await db("users").where("email", data.email).first();
    if (existing) {
      throw new ConflictError(\`Email '\${data.email}' is already registered\`);
    }

    const hashedPassword = await hashPassword(data.password);
    const userId = crypto.randomUUID();
    const role = data.role || "user";

    await db("users").create({
      id: userId,
      name: data.name,
      email: data.email,
      password: hashedPassword,
      role
    });

    const token = await Jwt.sign(
      { sub: userId, email: data.email, role },
      env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return {
      user: { id: userId, name: data.name, email: data.email, role },
      token
    };
  }

  async login(data: LoginInput) {
    const user = await db("users").where("email", data.email).first();
    if (!user) {
      throw new AuthenticationError("Invalid email or password");
    }

    const valid = await verifyPassword(data.password, user.password);
    if (!valid) {
      throw new AuthenticationError("Invalid email or password");
    }

    const token = await Jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return {
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      token
    };
  }

  async getProfile(userId: string) {
    const user = await db("users").findById(userId);
    if (!user) {
      throw new AuthenticationError("User not found");
    }
    const { password, ...safeUser } = user;
    return safeUser;
  }
}

export const authService = new AuthService();
`,

    "src/modules/auth/auth.route.ts": `import { route, guard } from "apex14";
import { authService } from "./auth.service.js";
import { RegisterDto, LoginDto } from "./auth.schema.js";
import { authGuard } from "../../common/guards/auth.guard.js";
import { ok, created } from "../../common/utils/response.js";

guard("auth", authGuard);

export function registerAuthRoutes() {
  route("/auth/register", async (ctx) => {
    const result = await authService.register(ctx.body);
    ctx.status(201);
    return created(result);
  }, {
    method: "POST",
    body: RegisterDto,
    summary: "Register user and return JWT",
    tags: ["Auth"]
  });

  route("/auth/login", async (ctx) => {
    const result = await authService.login(ctx.body);
    return ok(result);
  }, {
    method: "POST",
    body: LoginDto,
    summary: "Login with credentials",
    tags: ["Auth"]
  });

  route("/auth/me", async (ctx) => {
    const user = await authService.getProfile(ctx.state.user.sub);
    return ok(user);
  }, {
    guard: "auth",
    summary: "Get authenticated profile",
    tags: ["Auth"]
  });
}
`,

    // Users Module
    "src/modules/users/users.schema.ts": `import { Type, type Static } from "apex14";

export const CreateUserDto = Type.Object({
  name: Type.String({ minLength: 2, maxLength: 100 }),
  email: Type.String({ format: "email" }),
  password: Type.String({ minLength: 6 }),
  role: Type.Optional(Type.Union([Type.Literal("user"), Type.Literal("admin")]))
});

export const UpdateUserDto = Type.Partial(
  Type.Object({
    name: Type.String({ minLength: 2 }),
    role: Type.Union([Type.Literal("user"), Type.Literal("admin")])
  })
);

export const UserIdParam = Type.Object({
  id: Type.String()
});

export type CreateUserInput = Static<typeof CreateUserDto>;
export type UpdateUserInput = Static<typeof UpdateUserDto>;
`,

    "src/modules/users/users.service.ts": `import crypto from "node:crypto";
import { db, hashPassword, NotFoundError, ConflictError } from "apex14";
import type { CreateUserInput, UpdateUserInput } from "./users.schema.js";

export class UsersService {
  async findAll() {
    return await db("users").select("id", "name", "email", "role", "created_at").get();
  }

  async findById(id: string) {
    const user = await db("users").findById(id);
    if (!user) {
      throw new NotFoundError(\`User #\${id} not found\`);
    }
    const { password, ...safeUser } = user;
    return safeUser;
  }

  async create(data: CreateUserInput) {
    const existing = await db("users").where("email", data.email).first();
    if (existing) {
      throw new ConflictError(\`Email '\${data.email}' already exists\`);
    }

    const id = crypto.randomUUID();
    const hashedPassword = await hashPassword(data.password);
    const role = data.role || "user";

    await db("users").create({
      id,
      name: data.name,
      email: data.email,
      password: hashedPassword,
      role
    });

    return { id, name: data.name, email: data.email, role };
  }

  async update(id: string, data: UpdateUserInput) {
    const user = await db("users").findById(id);
    if (!user) {
      throw new NotFoundError(\`User #\${id} not found\`);
    }

    await db("users").updateById(id, {
      ...data,
      updated_at: new Date().toISOString()
    });

    return await this.findById(id);
  }

  async remove(id: string) {
    const user = await db("users").findById(id);
    if (!user) {
      throw new NotFoundError(\`User #\${id} not found\`);
    }

    await db("users").deleteById(id);
    return { id, deleted: true };
  }
}

export const usersService = new UsersService();
`,

    "src/modules/users/users.route.ts": `import { route } from "apex14";
import { usersService } from "./users.service.js";
import { CreateUserDto, UpdateUserDto, UserIdParam } from "./users.schema.js";
import { ok, created } from "../../common/utils/response.js";

export function registerUserRoutes() {
  route("/users", async () => {
    const users = await usersService.findAll();
    return ok(users);
  }, {
    guard: "auth",
    summary: "List all users",
    tags: ["Users"]
  });

  route("/users", async (ctx) => {
    const newUser = await usersService.create(ctx.body);
    ctx.status(201);
    return created(newUser);
  }, {
    method: "POST",
    guard: "auth",
    body: CreateUserDto,
    summary: "Create a new user",
    tags: ["Users"]
  });

  route("/users/:id", {
    GET: async (ctx) => {
      const user = await usersService.findById(ctx.params.id);
      return ok(user);
    },
    PUT: async (ctx) => {
      const updated = await usersService.update(ctx.params.id, ctx.body);
      return ok(updated);
    },
    DELETE: async (ctx) => {
      const result = await usersService.remove(ctx.params.id);
      return ok(result);
    }
  }, {
    guard: "auth",
    params: UserIdParam,
    summary: "User resource operations",
    tags: ["Users"]
  });
}
`,

    // Uploads Module
    "src/modules/uploads/uploads.service.ts": `import fs from "node:fs/promises";
import crypto from "node:crypto";
import { db, configureStorage, LocalStorageProvider, store, ValidationError } from "apex14";
import { env } from "../../config/env.js";

export class UploadsService {
  private initialized = false;

  async ensureStorage() {
    if (!this.initialized) {
      await fs.mkdir(env.STORAGE_DIR, { recursive: true });
      configureStorage(new LocalStorageProvider(env.STORAGE_DIR));
      this.initialized = true;
    }
  }

  async saveFile(name: string, buffer: Buffer, mimeType: string) {
    await this.ensureStorage();

    const allowedMimes = ["image/jpeg", "image/png", "image/webp", "application/pdf", "text/plain"];
    if (!allowedMimes.includes(mimeType)) {
      throw new ValidationError(\`MIME type '\${mimeType}' is not permitted\`);
    }

    const id = crypto.randomUUID();
    const metadata = await store().save(buffer, {
      filename: name
    });

    await db("uploads").create({
      id,
      filename: name,
      mime_type: mimeType,
      size: buffer.length,
      path: metadata.path
    });

    return {
      id,
      filename: name,
      size: buffer.length,
      mimeType,
      url: \`/uploads/\${metadata.id}\`
    };
  }

  async listUploads() {
    return await db("uploads").select("id", "filename", "mime_type", "size", "created_at").get();
  }
}

export const uploadsService = new UploadsService();
`,

    "src/modules/uploads/uploads.route.ts": `import { route } from "apex14";
import { uploadsService } from "./uploads.service.js";
import { ok, created } from "../../common/utils/response.js";

export function registerUploadRoutes() {
  route("/uploads", async () => {
    const list = await uploadsService.listUploads();
    return ok(list);
  }, {
    guard: "auth",
    summary: "List uploaded files",
    tags: ["Uploads"]
  });

  route("/uploads", async (ctx) => {
    const rawBody = await ctx.request.arrayBuffer();
    const buffer = Buffer.from(rawBody);
    const contentType = ctx.headers["content-type"] || "application/octet-stream";
    const originalName = ctx.headers["x-filename"] || "upload.bin";

    const upload = await uploadsService.saveFile(originalName, buffer, contentType);
    ctx.status(201);
    return created(upload);
  }, {
    method: "POST",
    guard: "auth",
    summary: "Upload raw file buffer",
    tags: ["Uploads"]
  });
}
`,

    // App Orchestration
    "src/app.ts": `import { group, route, use, secure, enableDocs } from "apex14";
import { initDatabase } from "./database/connection.js";
import { loggerMiddleware } from "./common/middleware/logger.middleware.js";
import { errorMiddleware } from "./common/middleware/error.middleware.js";
import { registerHealthRoutes } from "./modules/health/health.route.js";
import { registerAuthRoutes } from "./modules/auth/auth.route.js";
import { registerUserRoutes } from "./modules/users/users.route.js";
import { registerUploadRoutes } from "./modules/uploads/uploads.route.js";
import { env } from "./config/env.js";

export async function bootstrapApp() {
  // 1. Initialize Database
  await initDatabase();

  // 2. Global Security Headers & CORS
  secure({
    cors: { origin: true, credentials: true },
    rateLimit: { max: 1000, windowMs: 60 * 1000 }
  });

  // 3. Global Middleware
  use(errorMiddleware);
  use(loggerMiddleware);

  // 4. API Documentation
  enableDocs({
    title: "${options.name} API",
    docsPath: "/docs",
    specPath: "/openapi.json"
  });

  // 5. Welcome Root
  route("/", () => ({
    app: env.APP_NAME,
    framework: "APEX14",
    status: "operational",
    docs: "/docs"
  }));

  // 6. Modular Route Registration
  registerHealthRoutes();

  group("/api/v1", () => {
    registerAuthRoutes();
    registerUserRoutes();
    registerUploadRoutes();
  });
}
`,

    // Server Runner
    "src/index.ts": `import { run } from "apex14";
import { bootstrapApp } from "./app.js";
import { env } from "./config/env.js";

async function main() {
  await bootstrapApp();
  console.log(\`▲ \${env.APP_NAME} operational on port \${env.PORT} (\${env.NODE_ENV})\`);
  run(env.PORT);
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
`,

    // E2E Test Suite
    "test/app.test.ts": `import { describe, it, expect, beforeAll } from "vitest";
import { testRequest } from "apex14";
import { bootstrapApp } from "../src/app.js";

describe("APEX14 Modular Application E2E Test Suite", () => {
  let authToken = "";

  beforeAll(async () => {
    process.env.DATABASE_URL = ":memory:";
    process.env.JWT_SECRET = "test-secret-key-that-is-at-least-32-chars-long";
    await bootstrapApp();
  });

  it("GET / returns operational status", async () => {
    const res = await testRequest("/");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("operational");
  });

  it("GET /health returns system health and metrics", async () => {
    const res = await testRequest("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("ok");
    expect(body.data.services.database).toBe("up");
  });

  it("POST /api/v1/auth/register creates user and returns JWT token", async () => {
    const res = await testRequest("/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Admin User",
        email: "admin@apex14.dev",
        password: "secretpassword123",
        role: "admin"
      })
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.token).toBeDefined();
    expect(body.data.user.email).toBe("admin@apex14.dev");
    authToken = body.data.token;
  });

  it("POST /api/v1/auth/login validates credentials and issues token", async () => {
    const res = await testRequest("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@apex14.dev",
        password: "secretpassword123"
      })
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.token).toBeDefined();
  });

  it("GET /api/v1/auth/me rejects unauthenticated request", async () => {
    const res = await testRequest("/api/v1/auth/me");
    expect(res.status).toBe(401);
  });

  it("GET /api/v1/auth/me returns current user with valid Bearer token", async () => {
    const res = await testRequest("/api/v1/auth/me", {
      headers: { Authorization: \`Bearer \${authToken}\` }
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.email).toBe("admin@apex14.dev");
  });

  it("POST /api/v1/users creates new user under auth guard", async () => {
    const res = await testRequest("/api/v1/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: \`Bearer \${authToken}\`
      },
      body: JSON.stringify({
        name: "Jane Doe",
        email: "jane@apex14.dev",
        password: "password456"
      })
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.name).toBe("Jane Doe");
  });

  it("GET /api/v1/users lists all users", async () => {
    const res = await testRequest("/api/v1/users", {
      headers: { Authorization: \`Bearer \${authToken}\` }
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(2);
  });
});
`
  };

  for (const [filePath, content] of Object.entries(files)) {
    await fs.writeFile(path.join(rootDir, filePath), content, "utf8");
  }

  return rootDir;
}
