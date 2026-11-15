import type { TSchema } from "@apex14/validation";
import { db } from "./client.js";
import { ModelQuery, type FindOptions, type OrderDirection } from "./orm.js";

export interface ModelOptions {
  timestamps?: boolean;
  softDelete?: boolean;
  client?: string;
}

export function typeBoxToSqlType(propertySchema: any): string {
  if (!propertySchema) return "TEXT";
  const type = propertySchema.type;
  if (type === "integer") return "INTEGER";
  if (type === "number") return "REAL";
  if (type === "boolean") return "INTEGER";
  return "TEXT";
}

export class Model<T = any> {
  public tableName: string;
  public schema?: TSchema;
  public options: ModelOptions;
  private initialized = false;
  private initPromise?: Promise<void>;

  constructor(tableName: string, schema?: TSchema, options: ModelOptions = {}) {
    this.tableName = tableName.replace(/[^a-zA-Z0-9_]/g, "");
    this.schema = schema;
    this.options = { timestamps: true, softDelete: false, ...options };
    // Trigger eager table creation
    this.ensureTable();
  }

  public async ensureTable(): Promise<void> {
    if (this.initialized) return;
    if (!this.initPromise) {
      this.initPromise = (async () => {
        const columns: Record<string, string> = {
          id: "INTEGER PRIMARY KEY AUTOINCREMENT"
        };

        if (this.schema && typeof this.schema === "object" && (this.schema as any).properties) {
          const props = (this.schema as any).properties;
          for (const [key, propSchema] of Object.entries(props)) {
            if (key === "id") continue;
            const colType = typeBoxToSqlType(propSchema);
            columns[key] = colType;
          }
        }

        if (this.options.timestamps) {
          columns["created_at"] = "DATETIME DEFAULT CURRENT_TIMESTAMP";
          columns["updated_at"] = "DATETIME DEFAULT CURRENT_TIMESTAMP";
        }

        if (this.options.softDelete) {
          columns["deleted_at"] = "DATETIME DEFAULT NULL";
        }

        await db.schema.createTableIfNotExists(this.tableName, columns);

        // Non-destructive Schema Drift Auto-Migration
        try {
          const existingCols = await db.schema.getTableColumns(this.tableName);
          if (existingCols.length > 0) {
            const existingSet = new Set(existingCols.map((c) => c.toLowerCase()));
            for (const [colName, colType] of Object.entries(columns)) {
              if (!existingSet.has(colName.toLowerCase())) {
                await db.schema.addColumn(this.tableName, colName, colType);
              }
            }
          }
        } catch {
          // Gracefully continue if inspection is not supported
        }

        this.initialized = true;
      })();
    }
    await this.initPromise;
  }

  private query(): ModelQuery<T> {
    const q = db<T>(this.tableName);
    if (this.options.softDelete) {
      q.where("deleted_at", "IS NULL", null);
    }
    return q;
  }

  public async all(): Promise<T[]> {
    await this.ensureTable();
    return await this.query().get();
  }

  public async findMany(options?: FindOptions<T>): Promise<T[]> {
    await this.ensureTable();
    return await this.query().findMany(options);
  }

  public async find(id: string | number): Promise<T | null> {
    await this.ensureTable();
    return await this.query().findById(id);
  }

  public async findById(id: string | number): Promise<T | null> {
    await this.ensureTable();
    return await this.query().findById(id);
  }

  public async findOne(where: Record<string, any>): Promise<T | null> {
    await this.ensureTable();
    return await this.query().findFirst({ where });
  }

  public async findFirst(options?: FindOptions<T>): Promise<T | null> {
    await this.ensureTable();
    return await this.query().findFirst(options);
  }

  public async create(data: Record<string, any>): Promise<T> {
    await this.ensureTable();
    const payload = { ...data };
    if (this.options.timestamps) {
      const now = new Date().toISOString();
      if (!payload.created_at) payload.created_at = now;
      if (!payload.updated_at) payload.updated_at = now;
    }
    const created = await db<T>(this.tableName).create(payload);
    if ((created as any).id !== undefined) {
      const full = await db<T>(this.tableName).findById((created as any).id);
      if (full) return full;
    }
    return created;
  }

  public async createMany(items: Record<string, any>[]): Promise<T[]> {
    await this.ensureTable();
    const created: T[] = [];
    for (const item of items) {
      created.push(await this.create(item));
    }
    return created;
  }

  public async update(idOrWhere: string | number | Record<string, any>, data: Record<string, any>): Promise<T | null> {
    await this.ensureTable();
    const payload = { ...data };
    if (this.options.timestamps && !payload.updated_at) {
      payload.updated_at = new Date().toISOString();
    }

    if (typeof idOrWhere === "string" || typeof idOrWhere === "number") {
      return await db<T>(this.tableName).updateById(idOrWhere, payload);
    }
    await this.query().where(idOrWhere).update(payload);
    return await this.query().where(idOrWhere).first();
  }

  public async delete(idOrWhere: string | number | Record<string, any>): Promise<boolean> {
    await this.ensureTable();
    if (this.options.softDelete) {
      const now = new Date().toISOString();
      if (typeof idOrWhere === "string" || typeof idOrWhere === "number") {
        const res = await db<T>(this.tableName).where("id", idOrWhere).update({ deleted_at: now });
        return res.rowsAffected > 0;
      }
      const res = await db<T>(this.tableName).where(idOrWhere).update({ deleted_at: now });
      return res.rowsAffected > 0;
    }

    if (typeof idOrWhere === "string" || typeof idOrWhere === "number") {
      return await db<T>(this.tableName).deleteById(idOrWhere);
    }
    const res = await db<T>(this.tableName).where(idOrWhere).delete();
    return res.rowsAffected > 0;
  }

  public async count(where?: Record<string, any>): Promise<number> {
    await this.ensureTable();
    const q = this.query();
    if (where) q.where(where);
    return await q.count();
  }

  public where(fieldOrObj: string | Record<string, any>, operatorOrValue?: any, value?: any): ModelQuery<T> {
    return this.query().where(fieldOrObj, operatorOrValue, value);
  }

  public orderBy(field: string, direction?: OrderDirection): ModelQuery<T> {
    return this.query().orderBy(field, direction);
  }
}

export function model<T = any>(tableName: string, schema?: TSchema, options?: ModelOptions): Model<T> {
  return new Model<T>(tableName, schema, options);
}

// Bind to db.model helper
(db as any).model = model;
(db as any)._modelFactory = model;
