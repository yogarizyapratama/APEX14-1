import { describe, it, expect } from "vitest";
import {
  route,
  group,
  use,
  guard,
  inject,
  getService,
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
});
