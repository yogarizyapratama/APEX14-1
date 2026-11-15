import { describe, it, expect, beforeAll } from "vitest";
import {
  SqliteDatabaseClient,
  configureDatabase,
  db,
  resource
} from "./index.js";
import { createScope, withScope } from "@apex14/core";
import { Type } from "@apex14/validation";

describe("@apex14/database", () => {
  let sqlite: SqliteDatabaseClient;

  beforeAll(async () => {
    sqlite = new SqliteDatabaseClient(":memory:");
    configureDatabase(sqlite, "main");

    // Initialize test table via db.schema
    await db.schema.createTableIfNotExists("users", {
      id: "INTEGER PRIMARY KEY AUTOINCREMENT",
      name: "TEXT NOT NULL",
      email: "TEXT NOT NULL",
      role: "TEXT DEFAULT 'user'",
      deleted_at: "TEXT DEFAULT NULL"
    });
  });

  describe("SqliteDatabaseClient & Raw Methods", () => {
    it("executes queries with safe parameterization", async () => {
      const client = db.client("main");
      const insert = await client.execute(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        ["Alice", "alice@example.com"]
      );
      expect(insert.rowsAffected).toBe(1);

      const rows = await client.query<{ id: number; name: string }>(
        "SELECT * FROM users WHERE email = ?",
        ["alice@example.com"]
      );
      expect(rows.length).toBe(1);
      expect(rows[0]?.name).toBe("Alice");
    });

    it("supports atomic transactions with rollback on error", async () => {
      await expect(
        db.transaction(async (tx) => {
          await tx.execute("INSERT INTO users (name, email) VALUES (?, ?)", ["Bob", "bob@example.com"]);
          throw new Error("Forced rollback");
        })
      ).rejects.toThrow("Forced rollback");

      const rows = await db.query("SELECT * FROM users WHERE email = ?", ["bob@example.com"]);
      expect(rows.length).toBe(0);
    });

    it("passes health check", async () => {
      const healthy = await db.client("main").healthCheck();
      expect(healthy).toBe(true);
    });
  });

  describe("Full ORM Engine (db('users'))", () => {
    it("creates, queries, updates, and deletes records via fluent ORM methods", async () => {
      // 1. Create record via ORM
      const created = await db("users").create({
        name: "Dev User",
        email: "dev@apex14.dev",
        role: "admin"
      });
      expect(created.id).toBeDefined();
      expect(created.name).toBe("Dev User");

      const userId = created.id!;

      // 2. findById
      const user = await db("users").findById(userId);
      expect(user).not.toBeNull();
      expect(user?.email).toBe("dev@apex14.dev");

      // 3. findFirst with where
      const first = await db("users").findFirst({
        where: { email: "dev@apex14.dev" }
      });
      expect(first?.id).toBe(userId);

      // 4. Fluent chain: where + orderBy + limit + get
      const list = await db("users")
        .where({ role: "admin" })
        .orderBy("id", "DESC")
        .limit(10)
        .get();
      expect(list.length).toBeGreaterThan(0);
      expect(list[0]?.email).toBe("dev@apex14.dev");

      // 5. count & exists
      const count = await db("users").count();
      expect(count).toBeGreaterThan(0);
      const exists = await db("users").where({ email: "dev@apex14.dev" }).exists();
      expect(exists).toBe(true);

      // 6. update
      await db("users").where({ id: userId }).update({ name: "Dev User Updated" });
      const updated = await db("users").findById(userId);
      expect(updated?.name).toBe("Dev User Updated");

      // 7. deleteById
      const deleted = await db("users").deleteById(userId);
      expect(deleted).toBe(true);

      const afterDelete = await db("users").findById(userId);
      expect(afterDelete).toBeNull();
    });

    it("supports createMany and findMany with pagination", async () => {
      await db("users").createMany([
        { name: "User 1", email: "u1@example.com", role: "member" },
        { name: "User 2", email: "u2@example.com", role: "member" },
        { name: "User 3", email: "u3@example.com", role: "member" }
      ]);

      const paged = await db("users").findMany({
        where: { role: "member" },
        orderBy: ["id", "asc"],
        limit: 2,
        offset: 0
      });
      expect(paged.length).toBe(2);
      expect(paged[0]?.name).toBe("User 1");
      expect(paged[1]?.name).toBe("User 2");
    });
  });

  describe("Resource Engine", () => {
    it("generates full CRUD endpoints with zero boilerplate", async () => {
      const scope = createScope();
      await withScope(scope, async () => {
        resource("users", {
          database: "main",
          schema: Type.Object({
            name: Type.String(),
            email: Type.String()
          }),
          allowedFields: ["name", "email", "role"]
        });

        // 1. Create
        const createRes = await scope.handle(
          new Request("http://localhost/users", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name: "Charlie", email: "charlie@example.com" })
          })
        );
        expect(createRes.status).toBe(201);
        const created = await createRes.json();
        expect(created.id).toBeDefined();
        expect(created.name).toBe("Charlie");

        const userId = created.id;

        // 2. Read
        const readRes = await scope.handle(new Request(`http://localhost/users/${userId}`));
        expect(readRes.status).toBe(200);
        const user = await readRes.json();
        expect(user.email).toBe("charlie@example.com");

        // 3. List
        const listRes = await scope.handle(new Request("http://localhost/users?page=1&limit=10"));
        expect(listRes.status).toBe(200);
        const list = await listRes.json();
        expect(list.data.length).toBeGreaterThan(0);
        expect(list.meta.total).toBeGreaterThan(0);

        // 4. Update
        const updateRes = await scope.handle(
          new Request(`http://localhost/users/${userId}`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name: "Charlie Updated", email: "charlie@example.com" })
          })
        );
        expect(updateRes.status).toBe(200);
        const updated = await updateRes.json();
        expect(updated.name).toBe("Charlie Updated");

        // 5. Delete
        const deleteRes = await scope.handle(
          new Request(`http://localhost/users/${userId}`, {
            method: "DELETE"
          })
        );
        expect(deleteRes.status).toBe(200);
        const delResult = await deleteRes.json();
        expect(delResult.success).toBe(true);

        // 6. Verify Read returns 404 after delete
        const notFoundRes = await scope.handle(new Request(`http://localhost/users/${userId}`));
        expect(notFoundRes.status).toBe(404);
      });
    });
  });
});
