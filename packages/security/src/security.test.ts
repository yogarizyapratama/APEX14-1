import { describe, it, expect } from "vitest";
import {
  Jwt,
  hashPassword,
  verifyPassword,
  SlidingWindowRateLimiter,
  securityHeaders,
  cors,
  isPrivateIp,
  validateSafeUrl,
  assertSafeUrl
} from "./index.js";
import { ApexRequestContext, AuthenticationError, RateLimitError, ApexError } from "@apex14/http";

describe("@apex14/security", () => {
  describe("JWT", () => {
    const secret = "test-secret-key-that-is-very-secure-and-long-123456";

    it("signs and verifies a valid JWT payload", async () => {
      const token = await Jwt.sign({ sub: "user-123", role: "admin" }, secret, {
        expiresIn: "1h",
        issuer: "apex14-test"
      });

      expect(typeof token).toBe("string");

      const decoded = await Jwt.verify<{ sub: string; role: string; iss: string }>(token, secret, {
        issuer: "apex14-test"
      });
      expect(decoded.sub).toBe("user-123");
      expect(decoded.role).toBe("admin");
      expect(decoded.iss).toBe("apex14-test");
    });

    it("rejects expired tokens", async () => {
      const token = await Jwt.sign({ sub: "user-123" }, secret, {
        expiresIn: -10 // expired in the past
      });

      await expect(Jwt.verify(token, secret)).rejects.toThrow(AuthenticationError);
    });

    it("rejects tampered signatures", async () => {
      const token = await Jwt.sign({ sub: "user-123" }, secret);
      const tampered = token.slice(0, -4) + "abcd";

      await expect(Jwt.verify(tampered, secret)).rejects.toThrow(AuthenticationError);
    });

    it("rejects tokens with mismatched issuer or audience", async () => {
      const token = await Jwt.sign({ sub: "user-123" }, secret, {
        issuer: "legit-issuer",
        audience: "mobile-app"
      });

      await expect(
        Jwt.verify(token, secret, { issuer: "different-issuer" })
      ).rejects.toThrow(AuthenticationError);

      await expect(
        Jwt.verify(token, secret, { audience: "web-app" })
      ).rejects.toThrow(AuthenticationError);
    });
  });

  describe("Password Hashing", () => {
    it("hashes and verifies passwords securely", async () => {
      const password = "correct-horse-battery-staple";
      const hash = await hashPassword(password);

      expect(hash.startsWith("$apex$scrypt$")).toBe(true);

      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);

      const isWrong = await verifyPassword("wrong-password", hash);
      expect(isWrong).toBe(false);
    });
  });

  describe("Rate Limiter", () => {
    it("limits requests according to sliding window", async () => {
      const limiter = new SlidingWindowRateLimiter({ max: 3, windowMs: 1000 });
      const middleware = limiter.middleware();

      const req = new Request("http://localhost/api");
      const ctx = new ApexRequestContext({ request: req, ip: "10.0.0.99" });

      // First 3 requests succeed
      await middleware(ctx, async () => "ok 1");
      await middleware(ctx, async () => "ok 2");
      await middleware(ctx, async () => "ok 3");

      // 4th request must be rate limited
      await expect(middleware(ctx, async () => "ok 4")).rejects.toThrow(RateLimitError);
      limiter.dispose();
    });
  });

  describe("Security Headers & CORS", () => {
    it("adds secure headers to context", async () => {
      const mw = securityHeaders({ frameOptions: "DENY", contentTypeOptions: true });
      const req = new Request("http://localhost/");
      const ctx = new ApexRequestContext({ request: req });

      await mw(ctx, async () => "ok");

      expect(ctx.responseHeaders.get("x-frame-options")).toBe("DENY");
      expect(ctx.responseHeaders.get("x-content-type-options")).toBe("nosniff");
      expect(ctx.responseHeaders.get("strict-transport-security")).toContain("max-age=");
    });

    it("handles CORS preflight and headers", async () => {
      const mw = cors({ origin: "http://example.com", credentials: true });
      const req = new Request("http://localhost/", {
        method: "OPTIONS",
        headers: { origin: "http://example.com" }
      });
      const ctx = new ApexRequestContext({ request: req });

      await mw(ctx, async () => "ok");

      expect(ctx.responseHeaders.get("access-control-allow-origin")).toBe("http://example.com");
      expect(ctx.responseHeaders.get("access-control-allow-credentials")).toBe("true");
    });
  });

  describe("SSRF Guard", () => {
    it("detects private IP addresses", () => {
      expect(isPrivateIp("127.0.0.1")).toBe(true);
      expect(isPrivateIp("10.0.0.1")).toBe(true);
      expect(isPrivateIp("192.168.1.1")).toBe(true);
      expect(isPrivateIp("172.20.0.1")).toBe(true);
      expect(isPrivateIp("169.254.169.254")).toBe(true);
      expect(isPrivateIp("::1")).toBe(true);
      expect(isPrivateIp("8.8.8.8")).toBe(false);
      expect(isPrivateIp("1.1.1.1")).toBe(false);
    });

    it("blocks access to local / private addresses via assertSafeUrl", async () => {
      await expect(assertSafeUrl("http://127.0.0.1:8080/admin")).rejects.toThrow(ApexError);
      await expect(assertSafeUrl("http://169.254.169.254/latest/meta-data/")).rejects.toThrow(ApexError);
      await expect(assertSafeUrl("http://localhost:3000/api")).rejects.toThrow(ApexError);
      await expect(assertSafeUrl("ftp://example.com/file")).rejects.toThrow(ApexError);
    });
  });
});
