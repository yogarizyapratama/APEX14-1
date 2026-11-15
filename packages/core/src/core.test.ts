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
});
