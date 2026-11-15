import { route } from "@apex14/core";
import { NotFoundError, ValidationError, type ApexRequestContext } from "@apex14/http";
import type { TSchema } from "@apex14/validation";
import { db } from "./client.js";

export type ResourceOperation = "create" | "read" | "update" | "delete" | "list";

export interface ResourcePaginationOptions {
  default?: number;
  max?: number;
}

export interface ResourceOptions {
  database?: string;
  tableName?: string;
  schema?: TSchema;
  guard?: string | string[];
  operations?: ResourceOperation[];
  pagination?: ResourcePaginationOptions;
  allowedFields?: string[];
  softDelete?: boolean;
}

export function resource(name: string, options: ResourceOptions = {}): void {
  const table = options.tableName || name;
  const dbName = options.database || "main";
  const operations: ResourceOperation[] = options.operations || [
    "create",
    "read",
    "update",
    "delete",
    "list"
  ];
  const defaultLimit = options.pagination?.default || 20;
  const maxLimit = options.pagination?.max || 100;
  const routePrefix = name.startsWith("/") ? name : `/${name}`;

  const methodMap: Record<string, (ctx: ApexRequestContext) => any> = {};

  // 1. LIST: GET /name
  if (operations.includes("list")) {
    methodMap["GET"] = async (ctx: ApexRequestContext) => {
      const client = db(dbName);
      const page = Math.max(1, parseInt(String(ctx.query.page || "1"), 10) || 1);
      const requestedLimit = parseInt(String(ctx.query.limit || String(defaultLimit)), 10) || defaultLimit;
      const limit = Math.min(Math.max(1, requestedLimit), maxLimit);
      const offset = (page - 1) * limit;

      const whereClause = options.softDelete ? "WHERE deleted_at IS NULL" : "";

      const countRows = await client.query<{ total: number }>(
        `SELECT COUNT(*) as total FROM "${table}" ${whereClause}`
      );
      const total = Number(countRows[0]?.total || 0);

      const fields = options.allowedFields && options.allowedFields.length > 0
        ? options.allowedFields.map((f) => `"${f.replace(/[^a-zA-Z0-9_]/g, "")}"`).join(", ")
        : "*";

      const rows = await client.query(
        `SELECT ${fields} FROM "${table}" ${whereClause} LIMIT ? OFFSET ?`,
        [limit, offset]
      );

      return {
        data: rows,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      };
    };
  }

  // 2. CREATE: POST /name
  if (operations.includes("create")) {
    methodMap["POST"] = async (ctx: ApexRequestContext) => {
      const client = db(dbName);
      const body = ctx.body;
      if (!body || typeof body !== "object") {
        throw new ValidationError("Request body is required for creation");
      }

      const keys = Object.keys(body).filter((k) => {
        if (options.allowedFields && options.allowedFields.length > 0) {
          return options.allowedFields.includes(k);
        }
        return true;
      });

      if (keys.length === 0) {
        throw new ValidationError("No valid fields provided for creation");
      }

      const safeColumns = keys.map((k) => `"${k.replace(/[^a-zA-Z0-9_]/g, "")}"`).join(", ");
      const placeholders = keys.map(() => "?").join(", ");
      const values = keys.map((k) => (body as any)[k]);

      const result = await client.execute(
        `INSERT INTO "${table}" (${safeColumns}) VALUES (${placeholders})`,
        values
      );

      ctx.status(201);
      return {
        id: result.lastInsertRowid,
        ...body
      };
    };
  }

  route(routePrefix, methodMap, {
    guard: options.guard,
    body: options.schema
  });

  // 3. READ, UPDATE, DELETE: /name/:id
  const itemMap: Record<string, (ctx: ApexRequestContext) => any> = {};

  if (operations.includes("read")) {
    itemMap["GET"] = async (ctx: ApexRequestContext) => {
      const client = db(dbName);
      const id = ctx.params.id;
      const whereClause = options.softDelete
        ? `WHERE id = ? AND deleted_at IS NULL`
        : `WHERE id = ?`;

      const fields = options.allowedFields && options.allowedFields.length > 0
        ? options.allowedFields.map((f) => `"${f.replace(/[^a-zA-Z0-9_]/g, "")}"`).join(", ")
        : "*";

      const rows = await client.query(
        `SELECT ${fields} FROM "${table}" ${whereClause}`,
        [id]
      );

      if (rows.length === 0) {
        throw new NotFoundError(`Resource with ID '${id}' not found`);
      }

      return rows[0];
    };
  }

  if (operations.includes("update")) {
    itemMap["PUT"] = async (ctx: ApexRequestContext) => {
      const client = db(dbName);
      const id = ctx.params.id;
      const body = ctx.body;

      if (!body || typeof body !== "object") {
        throw new ValidationError("Request body is required for update");
      }

      // Check existence
      const existing = await client.query(`SELECT id FROM "${table}" WHERE id = ?`, [id]);
      if (existing.length === 0) {
        throw new NotFoundError(`Resource with ID '${id}' not found`);
      }

      const keys = Object.keys(body).filter((k) => {
        if (options.allowedFields && options.allowedFields.length > 0) {
          return options.allowedFields.includes(k);
        }
        return true;
      });

      if (keys.length === 0) {
        throw new ValidationError("No valid fields provided for update");
      }

      const setClauses = keys.map((k) => `"${k.replace(/[^a-zA-Z0-9_]/g, "")}" = ?`).join(", ");
      const values = [...keys.map((k) => (body as any)[k]), id];

      await client.execute(`UPDATE "${table}" SET ${setClauses} WHERE id = ?`, values);

      return {
        id,
        ...body
      };
    };
  }

  if (operations.includes("delete")) {
    itemMap["DELETE"] = async (ctx: ApexRequestContext) => {
      const client = db(dbName);
      const id = ctx.params.id;

      if (options.softDelete) {
        await client.execute(
          `UPDATE "${table}" SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [id]
        );
      } else {
        await client.execute(`DELETE FROM "${table}" WHERE id = ?`, [id]);
      }

      return { success: true, id };
    };
  }

  if (Object.keys(itemMap).length > 0) {
    route(`${routePrefix}/:id`, itemMap, {
      guard: options.guard
    });
  }
}
