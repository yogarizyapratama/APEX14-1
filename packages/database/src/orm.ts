import type { DatabaseClient } from "./client.js";
import { NotFoundError, ValidationError } from "@apex14/http";

export type OrderDirection = "ASC" | "DESC" | "asc" | "desc";

export interface WhereCondition {
  field: string;
  operator: "=" | "!=" | ">" | ">=" | "<" | "<=" | "LIKE" | "IN" | "IS NULL" | "IS NOT NULL";
  value: any;
  boolean: "AND" | "OR";
}

export interface FindOptions<T = any> {
  where?: Record<string, any>;
  orderBy?: Record<string, OrderDirection> | [string, OrderDirection];
  limit?: number;
  offset?: number;
  select?: string[];
  include?: string[] | string;
}

export class ModelQuery<T = any> {
  private tableName: string;
  private client: DatabaseClient;
  private whereClauses: WhereCondition[] = [];
  private selectedFields: string[] = ["*"];
  private orderClauses: Array<{ field: string; direction: string }> = [];
  private limitCount?: number;
  private offsetCount?: number;
  private includedRelations: string[] = [];
  private modelInstance?: any;

  constructor(tableName: string, client: DatabaseClient) {
    this.tableName = tableName.replace(/[^a-zA-Z0-9_]/g, "");
    this.client = client;
  }

  public setModel(model: any): this {
    this.modelInstance = model;
    return this;
  }

  public include(...relations: (string | string[])[]): this {
    const flat = relations.flat();
    for (const r of flat) {
      if (r && !this.includedRelations.includes(r)) {
        this.includedRelations.push(r);
      }
    }
    return this;
  }

  public select(...fields: string[]): this {
    if (fields.length > 0) {
      this.selectedFields = fields.map((f) => f.replace(/[^a-zA-Z0-9_*]/g, ""));
    }
    return this;
  }

  public where(fieldOrObj: string | Record<string, any>, operatorOrValue?: any, value?: any): this {
    if (typeof fieldOrObj === "object" && fieldOrObj !== null) {
      for (const [k, v] of Object.entries(fieldOrObj)) {
        if (v === null) {
          this.whereClauses.push({ field: k, operator: "IS NULL", value: null, boolean: "AND" });
        } else if (Array.isArray(v)) {
          this.whereClauses.push({ field: k, operator: "IN", value: v, boolean: "AND" });
        } else {
          this.whereClauses.push({ field: k, operator: "=", value: v, boolean: "AND" });
        }
      }
    } else if (typeof fieldOrObj === "string") {
      if (value === undefined) {
        if (Array.isArray(operatorOrValue)) {
          this.whereClauses.push({ field: fieldOrObj, operator: "IN", value: operatorOrValue, boolean: "AND" });
        } else {
          this.whereClauses.push({ field: fieldOrObj, operator: "=", value: operatorOrValue, boolean: "AND" });
        }
      } else {
        const op = String(operatorOrValue).toUpperCase();
        if (op === "IN") {
          this.whereClauses.push({ field: fieldOrObj, operator: "IN", value: Array.isArray(value) ? value : [value], boolean: "AND" });
        } else {
          this.whereClauses.push({ field: fieldOrObj, operator: operatorOrValue, value, boolean: "AND" });
        }
      }
    }
    return this;
  }

  public orWhere(field: string, operatorOrValue: any, value?: any): this {
    if (value === undefined) {
      if (Array.isArray(operatorOrValue)) {
        this.whereClauses.push({ field, operator: "IN", value: operatorOrValue, boolean: "OR" });
      } else {
        this.whereClauses.push({ field, operator: "=", value: operatorOrValue, boolean: "OR" });
      }
    } else {
      const op = String(operatorOrValue).toUpperCase();
      if (op === "IN") {
        this.whereClauses.push({ field, operator: "IN", value: Array.isArray(value) ? value : [value], boolean: "OR" });
      } else {
        this.whereClauses.push({ field, operator: operatorOrValue, value, boolean: "OR" });
      }
    }
    return this;
  }

  public orderBy(field: string, direction: OrderDirection = "ASC"): this {
    this.orderClauses.push({
      field: field.replace(/[^a-zA-Z0-9_]/g, ""),
      direction: direction.toUpperCase() === "DESC" ? "DESC" : "ASC"
    });
    return this;
  }

  public limit(count: number): this {
    this.limitCount = Math.max(0, count);
    return this;
  }

  public offset(count: number): this {
    this.offsetCount = Math.max(0, count);
    return this;
  }

  public async get(): Promise<T[]> {
    const { sql, params } = this.buildSelectSql();
    const rows = await this.client.query<T>(sql, params);
    if (rows.length === 0 || this.includedRelations.length === 0 || !this.modelInstance) {
      return rows;
    }
    await this.loadRelations(rows);
    return rows;
  }

  public async all(): Promise<T[]> {
    return await this.get();
  }

  private async loadRelations(rows: any[]): Promise<void> {
    for (const relName of this.includedRelations) {
      const relDef = this.modelInstance.getRelation ? this.modelInstance.getRelation(relName) : undefined;
      if (!relDef) continue;

      const targetModel = typeof relDef.target === "function" && !relDef.target.tableName
        ? relDef.target()
        : relDef.target;

      if (!targetModel) continue;
      if (typeof targetModel.ensureTable === "function") {
        await targetModel.ensureTable();
      }

      if (relDef.type === "hasMany") {
        const localKey = relDef.localKey || "id";
        const foreignKey = relDef.foreignKey || `${this.tableName.replace(/s$/, "")}_id`;

        for (const row of rows) {
          row[relName] = [];
        }

        const parentIds = Array.from(
          new Set(rows.map((r) => r[localKey]).filter((id) => id !== undefined && id !== null))
        );
        if (parentIds.length === 0) continue;

        // Single-query batching with WHERE foreignKey IN (...)
        const relatedItems = await targetModel.where(foreignKey, parentIds).get();

        const grouped = new Map<any, any[]>();
        for (const item of relatedItems) {
          const fVal = item[foreignKey];
          let list = grouped.get(fVal);
          if (!list) {
            list = [];
            grouped.set(fVal, list);
          }
          list.push(item);
        }

        for (const row of rows) {
          const pVal = row[localKey];
          row[relName] = grouped.get(pVal) || [];
        }
      } else if (relDef.type === "belongsTo") {
        const localKey = relDef.localKey || "id";
        const foreignKey = relDef.foreignKey || `${targetModel.tableName.replace(/s$/, "")}_id`;

        for (const row of rows) {
          row[relName] = null;
        }

        const foreignIds = Array.from(
          new Set(rows.map((r) => r[foreignKey]).filter((id) => id !== undefined && id !== null))
        );
        if (foreignIds.length === 0) continue;

        // Single-query batching with WHERE localKey IN (...)
        const relatedItems = await targetModel.where(localKey, foreignIds).get();

        const itemMap = new Map<any, any>();
        for (const item of relatedItems) {
          itemMap.set(item[localKey], item);
        }

        for (const row of rows) {
          const fVal = row[foreignKey];
          row[relName] = itemMap.get(fVal) || null;
        }
      }
    }
  }

  public async first(): Promise<T | null> {
    const prevLimit = this.limitCount;
    this.limitCount = 1;
    const rows = await this.get();
    this.limitCount = prevLimit;
    return rows[0] || null;
  }

  public async findMany(options: FindOptions<T> = {}): Promise<T[]> {
    if (options.where) this.where(options.where);
    if (options.select) this.select(...options.select);
    if (options.include) this.include(options.include);
    if (options.limit !== undefined) this.limit(options.limit);
    if (options.offset !== undefined) this.offset(options.offset);
    if (options.orderBy) {
      if (Array.isArray(options.orderBy)) {
        this.orderBy(options.orderBy[0], options.orderBy[1]);
      } else {
        for (const [f, dir] of Object.entries(options.orderBy)) {
          this.orderBy(f, dir);
        }
      }
    }
    return await this.get();
  }

  public async findFirst(options: FindOptions<T> = {}): Promise<T | null> {
    const rows = await this.findMany({ ...options, limit: 1 });
    return rows[0] || null;
  }

  public async findById(id: string | number): Promise<T | null> {
    return await this.where("id", id).first();
  }

  public async create(data: Record<string, any>): Promise<T> {
    if (!data || typeof data !== "object" || Object.keys(data).length === 0) {
      throw new ValidationError("Data is required to create a record");
    }

    const keys = Object.keys(data);
    const safeCols = keys.map((k) => `"${k.replace(/[^a-zA-Z0-9_]/g, "")}"`).join(", ");
    const placeholders = keys.map(() => "?").join(", ");
    const values = keys.map((k) => data[k]);

    const sql = `INSERT INTO "${this.tableName}" (${safeCols}) VALUES (${placeholders})`;
    const result = await this.client.execute(sql, values);

    const insertedId = result.lastInsertRowid !== undefined ? Number(result.lastInsertRowid) : undefined;
    return {
      ...(insertedId ? { id: insertedId } : {}),
      ...data
    } as T;
  }

  public async createMany(items: Record<string, any>[]): Promise<T[]> {
    const created: T[] = [];
    for (const item of items) {
      created.push(await this.create(item));
    }
    return created;
  }

  public async update(dataOrWhere: Record<string, any>, dataIfWhereProvided?: Record<string, any>): Promise<{ rowsAffected: number }> {
    let updateData: Record<string, any>;
    if (dataIfWhereProvided) {
      this.where(dataOrWhere);
      updateData = dataIfWhereProvided;
    } else {
      updateData = dataOrWhere;
    }

    const keys = Object.keys(updateData);
    if (keys.length === 0) {
      throw new ValidationError("No data provided to update");
    }

    const setClauses = keys.map((k) => `"${k.replace(/[^a-zA-Z0-9_]/g, "")}" = ?`).join(", ");
    const values = keys.map((k) => updateData[k]);

    let sql = `UPDATE "${this.tableName}" SET ${setClauses}`;
    const { whereSql, params: whereParams } = this.buildWhereSql();
    if (whereSql) {
      sql += ` WHERE ${whereSql}`;
      values.push(...whereParams);
    }

    const result = await this.client.execute(sql, values);
    return { rowsAffected: result.rowsAffected };
  }

  public async updateById(id: string | number, data: Record<string, any>): Promise<T | null> {
    await this.where("id", id).update(data);
    return await new ModelQuery<T>(this.tableName, this.client).findById(id);
  }

  public async delete(where?: Record<string, any>): Promise<{ rowsAffected: number }> {
    if (where) {
      this.where(where);
    }

    let sql = `DELETE FROM "${this.tableName}"`;
    const { whereSql, params } = this.buildWhereSql();
    if (whereSql) {
      sql += ` WHERE ${whereSql}`;
    }

    const result = await this.client.execute(sql, params);
    return { rowsAffected: result.rowsAffected };
  }

  public async deleteById(id: string | number): Promise<boolean> {
    const res = await this.where("id", id).delete();
    return res.rowsAffected > 0;
  }

  public async count(): Promise<number> {
    let sql = `SELECT COUNT(*) as count FROM "${this.tableName}"`;
    const { whereSql, params } = this.buildWhereSql();
    if (whereSql) {
      sql += ` WHERE ${whereSql}`;
    }
    const res = await this.client.query<{ count: number }>(sql, params);
    return Number(res[0]?.count || 0);
  }

  public async exists(): Promise<boolean> {
    const total = await this.count();
    return total > 0;
  }

  private buildWhereSql(): { whereSql: string; params: any[] } {
    if (this.whereClauses.length === 0) {
      return { whereSql: "", params: [] };
    }

    const parts: string[] = [];
    const params: any[] = [];

    for (let i = 0; i < this.whereClauses.length; i++) {
      const c = this.whereClauses[i]!;
      const prefix = i > 0 ? ` ${c.boolean} ` : "";
      const safeField = `"${c.field.replace(/[^a-zA-Z0-9_]/g, "")}"`;

      if (c.operator === "IS NULL" || c.operator === "IS NOT NULL") {
        parts.push(`${prefix}${safeField} ${c.operator}`);
      } else if (c.operator === "IN") {
        const inPlaceholders = Array.isArray(c.value) ? c.value.map(() => "?").join(", ") : "?";
        parts.push(`${prefix}${safeField} IN (${inPlaceholders})`);
        if (Array.isArray(c.value)) params.push(...c.value);
        else params.push(c.value);
      } else {
        parts.push(`${prefix}${safeField} ${c.operator} ?`);
        params.push(c.value);
      }
    }

    return { whereSql: parts.join(""), params };
  }

  private buildSelectSql(): { sql: string; params: any[] } {
    const fields = this.selectedFields.map((f) => (f === "*" ? "*" : `"${f}"`)).join(", ");
    let sql = `SELECT ${fields} FROM "${this.tableName}"`;
    const { whereSql, params } = this.buildWhereSql();

    if (whereSql) {
      sql += ` WHERE ${whereSql}`;
    }

    if (this.orderClauses.length > 0) {
      const orderParts = this.orderClauses.map((o) => `"${o.field}" ${o.direction}`).join(", ");
      sql += ` ORDER BY ${orderParts}`;
    }

    if (this.limitCount !== undefined) {
      sql += ` LIMIT ${this.limitCount}`;
    }

    if (this.offsetCount !== undefined) {
      sql += ` OFFSET ${this.offsetCount}`;
    }

    return { sql, params };
  }
}
