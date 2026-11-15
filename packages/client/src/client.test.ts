import { describe, it, expect } from "vitest";
import { createApexClient, ApexClientError } from "./index.js";

describe("@apex14/client", () => {
  it("translates chained proxy calls to correct HTTP requests and parses JSON response", async () => {
    const mockFetch = async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      expect(urlStr).toBe("https://api.apex14.dev/api/users?page=1&limit=10");
      expect(init?.method).toBe("GET");
      expect((init?.headers as Headers).get("authorization")).toBe("Bearer secret-token");

      return new Response(JSON.stringify([{ id: 1, name: "Alice" }]), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    };

    const client = createApexClient("https://api.apex14.dev", {
      headers: { authorization: "Bearer secret-token" },
      fetch: mockFetch as any
    });

    const users = await client.api.users.get({
      query: { page: 1, limit: 10 }
    });

    expect(users).toEqual([{ id: 1, name: "Alice" }]);
  });

  it("handles path parameters and JSON POST body", async () => {
    const mockFetch = async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      expect(urlStr).toBe("https://api.apex14.dev/users/42");
      expect(init?.method).toBe("POST");
      expect(init?.body).toBe(JSON.stringify({ role: "admin" }));

      return new Response(JSON.stringify({ success: true, id: 42, role: "admin" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    };

    const client = createApexClient("https://api.apex14.dev", {
      fetch: mockFetch as any
    });

    const res = await client.users(42).post({
      body: { role: "admin" }
    });

    expect(res.success).toBe(true);
    expect(res.role).toBe("admin");
  });

  it("throws ApexClientError on error responses", async () => {
    const mockFetch = async () => {
      return new Response(JSON.stringify({ error: { message: "User not found" } }), {
        status: 404,
        headers: { "content-type": "application/json" }
      });
    };

    const client = createApexClient("https://api.apex14.dev", {
      fetch: mockFetch as any
    });

    await expect(client.users(999).get()).rejects.toThrow("User not found");
  });
});
