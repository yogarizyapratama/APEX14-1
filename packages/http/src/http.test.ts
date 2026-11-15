import { describe, it, expect } from "vitest";
import {
  ApexRequestContext,
  ApexRedirect,
  serializeResponse,
  serializeErrorResponse,
  parseCookies,
  serializeCookie,
  signCookie,
  unsignCookie,
  ValidationError,
  AuthenticationError,
  NotFoundError,
  RateLimitError
} from "./index.js";

describe("@apex14/http", () => {
  describe("Context & Serialization", () => {
    it("creates context and parses headers and query parameters", () => {
      const req = new Request("http://localhost:3000/users/42?search=alex&filter=a&filter=b", {
        headers: {
          "x-custom": "hello",
          cookie: "sessionId=xyz123"
        }
      });

      const ctx = new ApexRequestContext({
        request: req,
        params: { id: "42" }
      });

      expect(ctx.params.id).toBe("42");
      expect(ctx.headers["x-custom"]).toBe("hello");
      expect(ctx.query.search).toBe("alex");
      expect(ctx.query.filter).toEqual(["a", "b"]);
      expect(ctx.cookies.sessionId).toBe("xyz123");
    });

    it("serializes strings to text/plain", async () => {
      const req = new Request("http://localhost:3000/");
      const ctx = new ApexRequestContext({ request: req });
      const res = serializeResponse("Hello World", ctx);

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/plain");
      expect(await res.text()).toBe("Hello World");
    });

    it("serializes objects and arrays automatically to application/json", async () => {
      const req = new Request("http://localhost:3000/");
      const ctx = new ApexRequestContext({ request: req });

      const objRes = serializeResponse({ status: "healthy", code: 200 }, ctx);
      expect(objRes.headers.get("content-type")).toContain("application/json");
      expect(await objRes.json()).toEqual({ status: "healthy", code: 200 });

      const arrRes = serializeResponse([1, 2, 3], ctx);
      expect(arrRes.headers.get("content-type")).toContain("application/json");
      expect(await arrRes.json()).toEqual([1, 2, 3]);
    });

    it("serializes numbers and booleans to json", async () => {
      const req = new Request("http://localhost:3000/");
      const ctx = new ApexRequestContext({ request: req });

      const numRes = serializeResponse(100, ctx);
      expect(await numRes.json()).toBe(100);

      const boolRes = serializeResponse(true, ctx);
      expect(await boolRes.json()).toBe(true);
    });

    it("serializes null to json-null and undefined to 204 No Content", async () => {
      const req = new Request("http://localhost:3000/");
      const ctx = new ApexRequestContext({ request: req });

      const nullRes = serializeResponse(null, ctx);
      expect(await nullRes.text()).toBe("null");

      const voidRes = serializeResponse(undefined, ctx);
      expect(voidRes.status).toBe(204);
    });

    it("handles redirects properly", () => {
      const req = new Request("http://localhost:3000/");
      const ctx = new ApexRequestContext({ request: req });
      const res = serializeResponse(new ApexRedirect("/login", 307), ctx);

      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("/login");
    });

    it("preserves native Response pass-through while applying context status/headers", async () => {
      const req = new Request("http://localhost:3000/");
      const ctx = new ApexRequestContext({ request: req });
      ctx.header("x-framework", "apex14");

      const raw = new Response("custom response", {
        status: 201,
        headers: { "x-custom": "raw-header" }
      });

      const res = serializeResponse(raw, ctx);
      expect(res.status).toBe(201);
      expect(res.headers.get("x-custom")).toBe("raw-header");
      expect(res.headers.get("x-framework")).toBe("apex14");
      expect(await res.text()).toBe("custom response");
    });
  });

  describe("Cookies", () => {
    it("parses cookies correctly", () => {
      const cookies = parseCookies("user=john; session_id=12345; secure_token=\"abc\"");
      expect(cookies.user).toBe("john");
      expect(cookies.session_id).toBe("12345");
      expect(cookies.secure_token).toBe("abc");
    });

    it("serializes cookies with options", () => {
      const s = serializeCookie("auth", "token123", {
        httpOnly: true,
        secure: true,
        sameSite: "Strict",
        maxAge: 3600
      });
      expect(s).toContain("auth=token123");
      expect(s).toContain("HttpOnly");
      expect(s).toContain("Secure");
      expect(s).toContain("SameSite=Strict");
      expect(s).toContain("Max-Age=3600");
    });

    it("signs and unsigns cookies safely with WebCrypto", async () => {
      const secret = "super-secret-key-that-is-at-least-32-chars-long";
      const signed = await signCookie("user-session-id-42", secret);
      expect(signed.startsWith("s:")).toBe(true);

      const verified = await unsignCookie(signed, secret);
      expect(verified).toBe("user-session-id-42");

      const tampered = signed.slice(0, -3) + "xyz";
      const fail = await unsignCookie(tampered, secret);
      expect(fail).toBe(false);
    });
  });

  describe("Errors", () => {
    it("formats ApexError and sub-classes correctly", () => {
      const err = new ValidationError("Invalid username", { field: "username" });
      expect(err.status).toBe(400);
      expect(err.code).toBe("VALIDATION_ERROR");

      const res = serializeErrorResponse(err);
      expect(res.status).toBe(400);

      const rateErr = new RateLimitError("Slow down", 60);
      expect(rateErr.status).toBe(429);
      expect(rateErr.retryAfterSeconds).toBe(60);
    });
  });
});
