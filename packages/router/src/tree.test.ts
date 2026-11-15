import { describe, it, expect } from "vitest";
import { RadixRouter } from "./tree.js";

describe("RadixRouter", () => {
  it("matches static routes", () => {
    const router = new RadixRouter();
    router.add({
      method: "GET",
      path: "/",
      handler: () => "root",
      middleware: [],
      metadata: {}
    });
    router.add({
      method: "GET",
      path: "/health",
      handler: () => "health",
      middleware: [],
      metadata: {}
    });

    const rootMatch = router.match("GET", "/");
    expect(rootMatch).not.toBeNull();
    expect(rootMatch?.handler({})).toBe("root");

    const healthMatch = router.match("GET", "/health");
    expect(healthMatch).not.toBeNull();
    expect(healthMatch?.handler({})).toBe("health");

    // Trailing slash
    const healthTrailing = router.match("GET", "/health/");
    expect(healthTrailing).not.toBeNull();
    expect(healthTrailing?.handler({})).toBe("health");

    // Unregistered path
    expect(router.match("GET", "/unknown")).toBeNull();
  });

  it("matches parameterized routes", () => {
    const router = new RadixRouter();
    router.add({
      method: "GET",
      path: "/users/:id",
      handler: (ctx) => `user-${ctx.params.id}`,
      middleware: [],
      metadata: {}
    });
    router.add({
      method: "GET",
      path: "/users/:userId/posts/:postId",
      handler: (ctx) => `post-${ctx.params.postId}-user-${ctx.params.userId}`,
      middleware: [],
      metadata: {}
    });

    const match1 = router.match("GET", "/users/42");
    expect(match1).not.toBeNull();
    expect(match1?.params).toEqual({ id: "42" });

    const match2 = router.match("GET", "/users/10/posts/99");
    expect(match2).not.toBeNull();
    expect(match2?.params).toEqual({ userId: "10", postId: "99" });
  });

  it("prioritizes static routes over parameterized and wildcards", () => {
    const router = new RadixRouter();
    router.add({
      method: "GET",
      path: "/users/me",
      handler: () => "static-me",
      middleware: [],
      metadata: {}
    });
    router.add({
      method: "GET",
      path: "/users/:id",
      handler: () => "param-id",
      middleware: [],
      metadata: {}
    });
    router.add({
      method: "GET",
      path: "/users/*rest",
      handler: () => "wildcard",
      middleware: [],
      metadata: {}
    });

    const matchStatic = router.match("GET", "/users/me");
    expect(matchStatic?.handler({})).toBe("static-me");

    const matchParam = router.match("GET", "/users/123");
    expect(matchParam?.handler({})).toBe("param-id");
    expect(matchParam?.params.id).toBe("123");

    const matchWildcard = router.match("GET", "/users/deep/nested/path");
    expect(matchWildcard?.handler({})).toBe("wildcard");
    expect(matchWildcard?.params.rest).toBe("deep/nested/path");
  });

  it("matches different HTTP methods on the same route", () => {
    const router = new RadixRouter();
    router.add({
      method: "GET",
      path: "/users",
      handler: () => "list users",
      middleware: [],
      metadata: {}
    });
    router.add({
      method: "POST",
      path: "/users",
      handler: () => "create user",
      middleware: [],
      metadata: {}
    });

    const getMatch = router.match("GET", "/users");
    expect(getMatch?.handler({})).toBe("list users");

    const postMatch = router.match("POST", "/users");
    expect(postMatch?.handler({})).toBe("create user");

    const deleteMatch = router.match("DELETE", "/users");
    expect(deleteMatch).toBeNull();
  });

  it("supports ALL wildcard method", () => {
    const router = new RadixRouter();
    router.add({
      method: "ALL",
      path: "/catch-all",
      handler: () => "any method",
      middleware: [],
      metadata: {}
    });

    expect(router.match("GET", "/catch-all")?.handler({})).toBe("any method");
    expect(router.match("POST", "/catch-all")?.handler({})).toBe("any method");
    expect(router.match("DELETE", "/catch-all")?.handler({})).toBe("any method");
  });

  it("returns all registered routes", () => {
    const router = new RadixRouter();
    router.add({
      method: "GET",
      path: "/a",
      handler: () => "a",
      middleware: [],
      metadata: { summary: "route A" }
    });
    router.add({
      method: "POST",
      path: "/b",
      handler: () => "b",
      middleware: [],
      metadata: {}
    });

    const list = router.getRoutes();
    expect(list.length).toBe(2);
    expect(list[0]?.path).toBe("/a");
    expect(list[0]?.metadata.summary).toBe("route A");
  });
});
