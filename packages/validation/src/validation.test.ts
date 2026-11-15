import { describe, it, expect } from "vitest";
import { Type, validateSchema, validateOrThrow, createValidationMiddleware } from "./index.js";
import { ApexRequestContext, ValidationError } from "@apex14/http";

describe("@apex14/validation", () => {
  const UserSchema = Type.Object({
    name: Type.String({ minLength: 2 }),
    email: Type.String({ format: "email" }),
    age: Type.Optional(Type.Number({ minimum: 0 }))
  });

  it("validates valid payload", () => {
    const validData = {
      name: "Alex",
      email: "alex@example.com",
      age: 28
    };

    const res = validateSchema(UserSchema, validData);
    expect(res.valid).toBe(true);
    expect(res.value).toEqual(validData);

    const val = validateOrThrow(UserSchema, validData);
    expect(val.name).toBe("Alex");
  });

  it("rejects invalid payload and returns structured errors", () => {
    const invalidData = {
      name: "A", // too short (< 2)
      email: "not-an-email"
    };

    const res = validateSchema(UserSchema, invalidData);
    expect(res.valid).toBe(false);
    expect(res.errors?.length).toBeGreaterThan(0);

    expect(() => validateOrThrow(UserSchema, invalidData, "body")).toThrow(ValidationError);
  });

  it("executes validation middleware and rejects bad request body with 400", async () => {
    const middleware = createValidationMiddleware({ body: UserSchema });

    const req = new Request("http://localhost/users", { method: "POST" });
    const ctx = new ApexRequestContext({ request: req });
    ctx.body = { name: "X", email: "invalid" };

    await expect(middleware(ctx, async () => ({ ok: true }))).rejects.toThrow(ValidationError);
  });

  it("passes validation middleware when request body is valid", async () => {
    const middleware = createValidationMiddleware({ body: UserSchema });

    const req = new Request("http://localhost/users", { method: "POST" });
    const ctx = new ApexRequestContext({ request: req });
    ctx.body = { name: "Jordan", email: "jordan@example.com" };

    const result = await middleware(ctx, async () => ({ id: 1, ...ctx.body }));
    expect(result.id).toBe(1);
    expect(result.name).toBe("Jordan");
  });
});
