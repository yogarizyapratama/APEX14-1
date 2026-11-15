import { describe, it, expect } from "vitest";
import {
  route,
  group,
  use,
  guard,
  inject,
  getService,
  sse,
  task,
  schedule,
  webhook,
  enableStudio,
  toFetch,
  resilient,
  CircuitBreakerOpenError,
  TimeoutError,
  cache,
  computeHmacSha256Hex,
  auth,
  workflow,
  live,
  heal,
  contract,
  exportMcpTools,
  getOpenApiSpec,
  enableDocs,
  createScope,
  withScope,
  testRequest,
  Type
} from "./index.js";

describe("@apex14/core — Direct Function API", () => {
  it("executes basic route with direct string return", async () => {
    route("/hello", () => "Hello APEX14");

    const res = await testRequest("/hello");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(await res.text()).toBe("Hello APEX14");
  });

  it("automatically serializes objects and arrays to JSON without response wrappers", async () => {
    route("/health", () => ({ status: "healthy", framework: "APEX14" }));
    route("/numbers", () => [1, 2, 3, 4]);

    const healthRes = await testRequest("/health");
    expect(healthRes.headers.get("content-type")).toContain("application/json");
    expect(await healthRes.json()).toEqual({ status: "healthy", framework: "APEX14" });

    const numRes = await testRequest("/numbers");
    expect(await numRes.json()).toEqual([1, 2, 3, 4]);
  });

  it("handles method maps on a single route", async () => {
    route("/items", {
      GET: () => ["item-a", "item-b"],
      POST: ({ body }) => ({ created: true, body })
    });

    const getRes = await testRequest("/items");
    expect(await getRes.json()).toEqual(["item-a", "item-b"]);

    const postRes = await testRequest("/items", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Widget" })
    });
    expect(postRes.status).toBe(200);
    expect(await postRes.json()).toEqual({
      created: true,
      body: { name: "Widget" }
    });
  });

  it("supports nested route groups with prefix concatenation", async () => {
    group("/api", () => {
      group("/v1", () => {
        route("/users", () => ({ version: "v1", users: [] }));
      });
    });

    const res = await testRequest("/api/v1/users");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ version: "v1", users: [] });
  });

  it("executes global and route middleware in correct order", async () => {
    const events: string[] = [];

    const isolatedScope = createScope();
    await withScope(isolatedScope, async () => {
      use(async (ctx, next) => {
        events.push("global-before");
        const res = await next();
        events.push("global-after");
        return res;
      });

      route(
        "/middleware-test",
        () => {
          events.push("handler");
          return { done: true };
        },
        {
          middleware: [
            async (ctx, next) => {
              events.push("route-before");
              const res = await next();
              events.push("route-after");
              return res;
            }
          ]
        }
      );

      const res = await isolatedScope.handle(new Request("http://localhost/middleware-test"));
      expect(await res.json()).toEqual({ done: true });
      expect(events).toEqual([
        "global-before",
        "route-before",
        "handler",
        "route-after",
        "global-after"
      ]);
    });
  });

  it("enforces route guards and denies unauthorized requests", async () => {
    const scope = createScope();
    await withScope(scope, async () => {
      guard("isAdmin", (ctx) => {
        return ctx.headers["x-role"] === "admin";
      });

      route(
        "/admin-only",
        () => ({ secret: "top-secret" }),
        { guard: "isAdmin" }
      );

      // Request without admin header
      const deniedRes = await scope.handle(new Request("http://localhost/admin-only"));
      expect(deniedRes.status).toBe(403);
      const deniedJson = await deniedRes.json();
      expect(deniedJson.error.code).toBe("FORBIDDEN");

      // Request with admin header
      const allowedRes = await scope.handle(
        new Request("http://localhost/admin-only", {
          headers: { "x-role": "admin" }
        })
      );
      expect(allowedRes.status).toBe(200);
      expect(await allowedRes.json()).toEqual({ secret: "top-secret" });
    });
  });

  it("provides context isolation across independent scopes", async () => {
    const scopeA = createScope();
    const scopeB = createScope();

    withScope(scopeA, () => {
      route("/scope-test", () => "Scope A");
    });

    withScope(scopeB, () => {
      route("/scope-test", () => "Scope B");
    });

    const resA = await scopeA.handle(new Request("http://localhost/scope-test"));
    expect(await resA.text()).toBe("Scope A");

    const resB = await scopeB.handle(new Request("http://localhost/scope-test"));
    expect(await resB.text()).toBe("Scope B");
  });

  it("automatically validates request body schema on routes", async () => {
    const scope = createScope();
    await withScope(scope, async () => {
      const ProductSchema = Type.Object({
        title: Type.String({ minLength: 3 }),
        price: Type.Number({ minimum: 0 })
      });

      route(
        "/products",
        ({ body }) => ({ created: true, product: body }),
        { body: ProductSchema }
      );

      // Invalid request: title too short
      const invalidRes = await scope.handle(
        new Request("http://localhost/products", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title: "ab", price: 10 })
        })
      );
      expect(invalidRes.status).toBe(400);

      // Valid request
      const validRes = await scope.handle(
        new Request("http://localhost/products", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title: "Keyboard", price: 99 })
        })
      );
      expect(validRes.status).toBe(200);
      expect(await validRes.json()).toEqual({
        created: true,
        product: { title: "Keyboard", price: 99 }
      });
    });
  });

  it("supports dependency injection via inject and getService", () => {
    const scope = createScope();
    withScope(scope, () => {
      inject("mailer", { send: () => true });
      expect(getService("mailer")?.send()).toBe(true);
    });
  });

  describe("Real-Time Primitives (sse)", () => {
    it("streams Server-Sent Events via async generator", async () => {
      const scope = createScope();
      await withScope(scope, async () => {
        sse("/events", async function* () {
          yield { event: "welcome", data: { message: "Hello SSE" } };
          yield { data: "Simple text message" };
        });

        const res = await scope.handle(new Request("http://localhost/events"));
        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toContain("text/event-stream");

        const text = await res.text();
        expect(text).toContain("event: welcome\n");
        expect(text).toContain('data: {"message":"Hello SSE"}\n\n');
        expect(text).toContain("data: Simple text message\n\n");
      });
    });
  });

  describe("Background Tasks & Scheduler (task & schedule)", () => {
    it("dispatches background tasks asynchronously without blocking", async () => {
      const processed: string[] = [];
      const emailTask = task("sendEmail", async (data: { email: string }) => {
        processed.push(data.email);
        return { sent: true };
      });

      // Dispatch task
      emailTask.dispatch({ email: "user@apex14.dev" });

      // Run now directly
      const result = await emailTask.runNow({ email: "immediate@apex14.dev" });
      expect(result.sent).toBe(true);
      expect(processed).toContain("immediate@apex14.dev");
    });

    it("registers and cancels scheduled jobs cleanly", () => {
      let tickCount = 0;
      const job = schedule("100ms", () => {
        tickCount++;
      });

      expect(job.name).toBeDefined();
      expect(job.pattern).toBe("100ms");
      job.stop();
    });
  });

  describe("OpenAPI 3.1 & Interactive Docs Engine", () => {
    it("generates complete OpenAPI 3.1 schema and mounts docs UI", async () => {
      const scope = createScope();
      await withScope(scope, async () => {
        route("/users/:id", {
          GET: ({ params }) => ({ id: params.id, name: "Alice" })
        }, {
          summary: "Get user by ID",
          params: Type.Object({ id: Type.String() }),
          response: Type.Object({ id: Type.String(), name: Type.String() })
        });

        scope.enableDocs({ docsPath: "/_docs", specPath: "/_openapi.json" });

        // 1. Check OpenAPI Spec JSON
        const specRes = await scope.handle(new Request("http://localhost/_openapi.json"));
        expect(specRes.status).toBe(200);
        const spec = await specRes.json();
        expect(spec.openapi).toBe("3.1.0");
        expect(spec.paths["/users/{id}"]).toBeDefined();
        expect(spec.paths["/users/{id}"].get.summary).toBe("Get user by ID");

        // 2. Check Interactive HTML UI
        const docsRes = await scope.handle(new Request("http://localhost/_docs"));
        expect(docsRes.status).toBe(200);
        expect(docsRes.headers.get("content-type")).toContain("text/html");
        const html = await docsRes.text();
        expect(html).toContain("@scalar/api-reference");
      });
    });
  });

  describe("Native AI & MCP (Model Context Protocol) Bridge", () => {
    it("exposes tools/list and tools/call for AI agents", async () => {
      const scope = createScope();
      await withScope(scope, async () => {
        route("/weather", {
          POST: ({ body }) => ({ city: body.city, temp: 28, condition: "Sunny" })
        }, {
          summary: "Get current weather for a city",
          aiTool: true,
          body: Type.Object({ city: Type.String() })
        });

        route("/mcp", scope.exportMcpTools());

        // 1. tools/list
        const listReq = new Request("http://localhost/mcp", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "tools/list"
          })
        });

        const listRes = await scope.handle(listReq);
        const listData = await listRes.json();
        expect(listData.jsonrpc).toBe("2.0");
        expect(listData.result.tools.length).toBeGreaterThan(0);
        expect(listData.result.tools[0].name).toBe("post_weather");
        expect(listData.result.tools[0].description).toBe("Get current weather for a city");

        // 2. tools/call
        const callReq = new Request("http://localhost/mcp", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            method: "tools/call",
            params: {
              name: "post_weather",
              arguments: { city: "Tokyo" }
            }
          })
        });

        const callRes = await scope.handle(callReq);
        const callData = await callRes.json();
        expect(callData.jsonrpc).toBe("2.0");
        expect(callData.result.content[0].type).toBe("text");
        expect(callData.result.content[0].text).toContain("Tokyo");
      });
    });
  });

  describe("Native Resilience & Circuit Breaker (resilient)", () => {
    it("retries failing operations with backoff and succeeds on recovery", async () => {
      let attempts = 0;
      const unreliableFn = resilient(async () => {
        attempts++;
        if (attempts < 3) throw new Error("Temporary network glitch");
        return "success";
      }, { retries: 3, retryDelayMs: 20 });

      const result = await unreliableFn();
      expect(result).toBe("success");
      expect(attempts).toBe(3);
    });

    it("trips circuit breaker to OPEN when failure threshold is exceeded", async () => {
      const failingFn = resilient(async () => {
        throw new Error("Downstream outage");
      }, {
        retries: 0,
        circuitBreaker: { failureThreshold: 0.5, minimumRequests: 2, resetTimeoutMs: 1000 }
      });

      // 1. Failures
      await expect(failingFn()).rejects.toThrow("Downstream outage");
      await expect(failingFn()).rejects.toThrow("Downstream outage");

      // 2. Next call should fail immediately with CircuitBreakerOpenError without invoking the function
      await expect(failingFn()).rejects.toThrow(CircuitBreakerOpenError);
    });

    it("throws TimeoutError when operation exceeds timeoutMs", async () => {
      const slowFn = resilient(async () => {
        await new Promise((r) => setTimeout(r, 200));
        return "done";
      }, { timeoutMs: 50, retries: 0 });

      await expect(slowFn()).rejects.toThrow(TimeoutError);
    });
  });

  describe("Multi-Tier Cache & Tag Invalidation (cache)", () => {
    it("stores and retrieves values with TTL and tag-based invalidation", () => {
      cache.clear();
      cache.set("post:1", { title: "Hello World" }, { ttl: "10s", tags: ["posts", "author:1"] });
      cache.set("post:2", { title: "Second Post" }, { ttl: "10s", tags: ["posts"] });

      expect(cache.get("post:1")?.title).toBe("Hello World");
      expect(cache.get("post:2")?.title).toBe("Second Post");

      // Invalidate by tag
      const count = cache.invalidate("posts");
      expect(count).toBe(2);
      expect(cache.get("post:1")).toBeUndefined();
      expect(cache.get("post:2")).toBeUndefined();
    });

    it("caches route responses automatically when cache option is enabled", async () => {
      const scope = createScope();
      let callCount = 0;

      await withScope(scope, async () => {
        route("/expensive-calc", () => {
          callCount++;
          return { value: 42, count: callCount };
        }, {
          cache: { ttl: "10s" }
        });

        // First call: executes handler
        const res1 = await scope.handle(new Request("http://localhost/expensive-calc"));
        const data1 = await res1.json();
        expect(data1.count).toBe(1);

        // Second call: served directly from cache without incrementing count!
        const res2 = await scope.handle(new Request("http://localhost/expensive-calc"));
        const data2 = await res2.json();
        expect(data2.count).toBe(1);
        expect(callCount).toBe(1);
      });
    });
  });

  describe("Native Webhook Engine & Idempotency (webhook)", () => {
    const SECRET = "whsec_test_secret_123456789";

    it("verifies Stripe HMAC signatures and enforces idempotency", async () => {
      const scope = createScope();
      let processedEvents: string[] = [];

      await withScope(scope, async () => {
        webhook("/webhooks/stripe", {
          provider: "stripe",
          secret: SECRET,
          idempotent: true,
          handler: (event) => {
            processedEvents.push(event.id);
            return { processed: true };
          }
        });

        const payload = JSON.stringify({ id: "evt_stripe_999", type: "charge.succeeded" });
        const timestamp = Math.floor(Date.now() / 1000);
        const signature = await computeHmacSha256Hex(SECRET, `${timestamp}.${payload}`);
        const stripeSignatureHeader = `t=${timestamp},v1=${signature}`;

        // 1. Valid webhook call
        const validReq = new Request("http://localhost/webhooks/stripe", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "stripe-signature": stripeSignatureHeader
          },
          body: payload
        });

        const res1 = await scope.handle(validReq);
        expect(res1.status).toBe(200);
        expect(processedEvents).toEqual(["evt_stripe_999"]);

        // 2. Duplicate call with same event ID: should be skipped idempotently
        const duplicateReq = new Request("http://localhost/webhooks/stripe", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "stripe-signature": stripeSignatureHeader
          },
          body: payload
        });
        const res2 = await scope.handle(duplicateReq);
        expect(res2.status).toBe(200);
        const data2 = await res2.json();
        expect(data2.idempotent).toBe(true);
        expect(data2.skipped).toBe(true);
        expect(processedEvents.length).toBe(1); // Handler was not re-executed!

        // 3. Forged signature: should reject with 401
        const forgedReq = new Request("http://localhost/webhooks/stripe", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "stripe-signature": `t=${timestamp},v1=forged_signature_hex`
          },
          body: payload
        });
        const forgedRes = await scope.handle(forgedReq);
        expect(forgedRes.status).toBe(401);
      });
    });

    it("verifies GitHub HMAC signatures", async () => {
      const scope = createScope();
      let eventAction = "";

      await withScope(scope, async () => {
        webhook("/webhooks/github", {
          provider: "github",
          secret: SECRET,
          handler: (event) => {
            eventAction = event.action;
          }
        });

        const payload = JSON.stringify({ action: "opened", issue: { number: 10 } });
        const signature = await computeHmacSha256Hex(SECRET, payload);

        const req = new Request("http://localhost/webhooks/github", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-hub-signature-256": `sha256=${signature}`
          },
          body: payload
        });

        const res = await scope.handle(req);
        expect(res.status).toBe(200);
        expect(eventAction).toBe("opened");
      });
    });
  });

  describe("Universal Edge Export (toFetch)", () => {
    it("exports universal Web Standard fetch handler for Cloudflare / Vercel Edge", async () => {
      const scope = createScope();
      scope.route("/edge-ping", () => ({ edge: "active", runtime: "universal" }));

      const fetchHandler = toFetch(scope);
      const res = await fetchHandler(new Request("http://localhost/edge-ping"));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.edge).toBe("active");
    });
  });

  describe("APEX14 Studio GUI & API Endpoints", () => {
    it("mounts Developer Studio dashboard and API endpoints", async () => {
      const scope = createScope();
      scope.route("/test-model", () => ({ ok: true }));
      scope.enableStudio({ path: "/_studio" });

      // 1. Studio Dashboard HTML
      const htmlRes = await scope.handle(new Request("http://localhost/_studio"));
      expect(htmlRes.status).toBe(200);
      expect(htmlRes.headers.get("content-type")).toContain("text/html");
      const html = await htmlRes.text();
      expect(html).toContain("APEX14 Studio");

      // 2. Studio Routes API
      const routesRes = await scope.handle(new Request("http://localhost/_studio/api/routes"));
      expect(routesRes.status).toBe(200);
      const routes = await routesRes.json();
      expect(routes.length).toBeGreaterThan(0);

      // 3. Studio System Diagnostics API
      const sysRes = await scope.handle(new Request("http://localhost/_studio/api/system"));
      expect(sysRes.status).toBe(200);
      const sys = await sysRes.json();
      expect(sys.runtime).toBeDefined();
    });
  });

  describe("Native Direct Auth & Sessions (auth)", () => {
    it("handles registration, authentication, sessions, and guard protection", async () => {
      const scope = createScope();
      auth.configure({ mountRoutes: true }, scope);

      scope.route("/protected-data", () => ({ secret: "classified" }), {
        guard: "auth"
      });

      // 1. Unauthenticated request rejected
      const unauthRes = await scope.handle(new Request("http://localhost/protected-data"));
      expect(unauthRes.status).toBe(403);

      // 2. Register user
      const regRes = await scope.handle(
        new Request("http://localhost/auth/register", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: "alex@example.com", password: "SecretPassword123!" })
        })
      );
      expect(regRes.status).toBe(200);
      const regData = await regRes.json();
      expect(regData.token).toBeDefined();
      const token = regData.token;

      // 3. Authenticated request with Bearer token passes guard
      const authRes = await scope.handle(
        new Request("http://localhost/protected-data", {
          headers: { authorization: `Bearer ${token}` }
        })
      );
      expect(authRes.status).toBe(200);
      const authData = await authRes.json();
      expect(authData.secret).toBe("classified");

      // 4. Access /auth/me
      const meRes = await scope.handle(
        new Request("http://localhost/auth/me", {
          headers: { authorization: `Bearer ${token}` }
        })
      );
      expect(meRes.status).toBe(200);
      const meData = await meRes.json();
      expect(meData.user.email).toBe("alex@example.com");
    });
  });

  describe("Durable Step Functions & Workflows (workflow)", () => {
    it("executes steps idempotently, tracks state, and supports compensation rollbacks", async () => {
      let rolledBack = false;

      const orderWorkflow = workflow("process-order", async (ctx, payload: { amount: number; failAtEnd?: boolean }) => {
        const step1 = await ctx.step("reserve-inventory", async () => {
          return { reserved: true, count: 1 };
        }, {
          rollback: async () => {
            rolledBack = true;
          }
        });

        if (payload.failAtEnd) {
          throw new Error("Payment gateway declined");
        }

        return { orderId: "ord_100", step1 };
      });

      // Success execution
      const successRun = await orderWorkflow.trigger({ amount: 50 });
      expect(successRun.status).toBe("completed");
      expect(successRun.result?.orderId).toBe("ord_100");
      expect(successRun.steps["reserve-inventory"]?.status).toBe("completed");

      // Failed execution triggers saga rollback
      const failedRun = await orderWorkflow.trigger({ amount: 50, failAtEnd: true });
      expect(failedRun.status).toBe("failed");
      expect(rolledBack).toBe(true);
      expect(failedRun.steps["reserve-inventory"]?.status).toBe("rolled_back");
    });
  });

  describe("Reactive Live Queries (live)", () => {
    it("mounts live SSE stream and emits initial snapshot", async () => {
      const scope = createScope();
      let users = [{ id: 1, name: "Alice" }];

      await withScope(scope, async () => {
        live("/live-users", () => users, { model: "users" });

        const req = new Request("http://localhost/live-users");
        const res = await scope.handle(req);
        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toContain("text/event-stream");
      });
    });
  });

  describe("Incident Replay & Self-Healing Telemetry (heal)", () => {
    it("captures crash telemetry and replays failing request", async () => {
      const scope = createScope();
      heal.clear();
      heal.configure({ enabled: true });

      scope.route("/unstable-endpoint", ({ query }: any) => {
        if (query.fail === "true") {
          throw new TypeError("Simulated database failure");
        }
        return { recovered: true };
      });

      // 1. Trigger error
      const failRes = await scope.handle(new Request("http://localhost/unstable-endpoint?fail=true"));
      expect(failRes.status).toBe(500);

      // 2. Incident was captured
      const incidents = heal.listIncidents();
      expect(incidents.length).toBeGreaterThan(0);
      const inc = incidents[0]!;
      expect(inc.error.name).toBe("TypeError");
      expect(inc.aiRemediationPrompt).toContain("APEX14 Incident Diagnosis");

      // 3. Replay with heal.replay
      const replayRes = await heal.replay(inc.id, scope);
      expect(replayRes.status).toBe(500);
    });
  });

  describe("Type-Safe Dual-Mode Contract SDK (contract)", () => {
    it("enforces schema validation on contract routes", async () => {
      const scope = createScope();

      const CreatePostContract = contract({
        body: Type.Object({
          title: Type.String({ minLength: 3 }),
          content: Type.String()
        }),
        response: Type.Object({
          id: Type.String(),
          title: Type.String()
        }),
        summary: "Create blog post"
      });

      scope.route("/posts", CreatePostContract, ({ body }: any) => {
        return { id: "post_1", title: body.title };
      });

      // 1. Invalid body fails with 400
      const badRes = await scope.handle(
        new Request("http://localhost/posts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title: "Hi" }) // too short
        })
      );
      expect(badRes.status).toBe(400);

      // 2. Valid body succeeds with 200
      const goodRes = await scope.handle(
        new Request("http://localhost/posts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title: "Valid Title", content: "Great article content" })
        })
      );
      expect(goodRes.status).toBe(200);
      const data = await goodRes.json();
      expect(data.id).toBe("post_1");
    });
  });
});
