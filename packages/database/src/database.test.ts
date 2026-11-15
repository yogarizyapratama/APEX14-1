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

    // Initialize test table
    await sqlite.execute(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        deleted_at TEXT DEFAULT NULL
      );
    `);
  });

  describe("SqliteDatabaseClient", () => {
    it("executes queries with safe parameterization", async () => {
      const client = db("main");
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
      const client = db("main");

      await expect(
        client.transaction(async (tx) => {
          await tx.execute("INSERT INTO users (name, email) VALUES (?, ?)", ["Bob", "bob@example.com"]);
          throw new Error("Forced rollback");
        })
      ).rejects.toThrow("Forced rollback");

      const rows = await client.query("SELECT * FROM users WHERE email = ?", ["bob@example.com"]);
      expect(rows.length).toBe(0);
    });

    it("passes health check", async () => {
      const healthy = await db("main").healthCheck();
      expect(healthy).toBe(true);
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
