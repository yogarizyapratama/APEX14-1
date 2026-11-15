import { describe, it, expect, afterAll } from "vitest";
import {
  route,
  group,
  use,
  guard,
  secure,
  run,
  file,
  db,
  Type,
  testRequest,
  createScope,
  withScope,
  lock,
  throttle,
  verify,
  mock,
  patch,
  wasm,
  delta,
  policy,
  stream,
  replay,
  snapshot,
  sdk
} from "./index.js";

describe("APEX14 — Direct Function API Acceptance Criteria (Section 39)", () => {
  let serverHandle: any;

  afterAll(async () => {
    if (serverHandle && serverHandle.close) {
      await serverHandle.close();
    }
  });

  it("satisfies Acceptance Criteria 1: Basic usage with direct string return", async () => {
    route("/", () => "Hello World");

    const res = await testRequest("/");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("Hello World");
  });

  it("satisfies Acceptance Criteria 2: Direct JSON return without wrappers", async () => {
    route("/health", () => ({
      status: "healthy",
      framework: "APEX14"
    }));

    const res = await testRequest("/health");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.json()).toEqual({
      status: "healthy",
      framework: "APEX14"
    });
  });

  it("satisfies Acceptance Criteria 3: Multiple methods on a single route", async () => {
    const memoryUsers = [{ id: 1, name: "Alex" }];

    route("/users", {
      GET: () => memoryUsers,
      POST: ({ body }) => {
        const newUser = { id: memoryUsers.length + 1, name: body.name };
        memoryUsers.push(newUser);
        return newUser;
      }
    });

    // GET
    const getRes = await testRequest("/users");
    expect(await getRes.json()).toEqual([{ id: 1, name: "Alex" }]);

    // POST
    const postRes = await testRequest("/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Jordan" })
    });
    expect(await postRes.json()).toEqual({ id: 2, name: "Jordan" });
  });

  it("satisfies Acceptance Criteria 4 & 5: Global middleware & Route Groups", async () => {
    const logTrace: string[] = [];

    const scope = createScope();
    await withScope(scope, async () => {
      use(async (ctx, next) => {
        logTrace.push(`in:${ctx.request.method}:${ctx.url.pathname}`);
        const res = await next();
        logTrace.push(`out:${ctx.responseStatus}`);
        return res;
      });

      group("/api", () => {
        route("/v1/status", () => ({ apiStatus: "online" }));
      });

      const res = await scope.handle(new Request("http://localhost/api/v1/status"));
      expect(await res.json()).toEqual({ apiStatus: "online" });
      expect(logTrace).toEqual(["in:GET:/api/v1/status", "out:200"]);
    });
  });

  it("satisfies Acceptance Criteria 6: Protected routes with guards", async () => {
    const scope = createScope();
    await withScope(scope, async () => {
      guard("auth", (ctx) => {
        return ctx.headers["authorization"] === "Bearer secret-token";
      });

      route(
        "/admin/dashboard",
        () => ({ metrics: "all-good" }),
        { guard: "auth" }
      );

      // Denied
      const denied = await scope.handle(new Request("http://localhost/admin/dashboard"));
      expect(denied.status).toBe(403);

      // Allowed
      const allowed = await scope.handle(
        new Request("http://localhost/admin/dashboard", {
          headers: { authorization: "Bearer secret-token" }
        })
      );
      expect(allowed.status).toBe(200);
      expect(await allowed.json()).toEqual({ metrics: "all-good" });
    });
  });

  it("satisfies Acceptance Criteria 7: File handling", async () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01]);
    const saved = await file.save(pngBytes, { filename: "test.png" });
    expect(saved.id).toBeDefined();

    const downloaded = await file.download(saved.id);
    expect(downloaded.contentType).toBe("image/png");

    await file.delete(saved.id);
  });

  it("satisfies Acceptance Criteria 8: Server startup with run()", async () => {
    serverHandle = await run({ port: 0, silent: true });
    expect(serverHandle.port).toBeGreaterThan(0);
    expect(serverHandle.url).toContain("http://");

    const res = await fetch(`${serverHandle.url}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "healthy", framework: "APEX14" });

    await serverHandle.close();
  });

  it("exports Quantum-Leap primitives directly from apex14 umbrella", async () => {
    expect(typeof lock).toBe("function");
    expect(typeof throttle).toBe("function");
    expect(typeof verify.signedRequest).toBe("function");
    expect(typeof mock.one).toBe("function");
    expect(typeof patch.route).toBe("function");
    expect(typeof wasm.load).toBe("function");

    // Quick sanity checks
    const val = await lock("sanity", async () => "locked");
    expect(val).toBe("locked");

    const dummy = mock.one(Type.Object({ name: Type.String() }), { seed: 123 });
    expect(typeof dummy.name).toBe("string");

    // Frontier-Next primitives verification
    expect(typeof delta.diff).toBe("function");
    expect(typeof policy.define).toBe("function");
    expect(typeof stream.from).toBe("function");
    expect(typeof replay.record).toBe("function");
    expect(typeof snapshot.verify).toBe("function");
    expect(typeof sdk.generate).toBe("function");
  });
});
