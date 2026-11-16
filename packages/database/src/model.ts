import type { TSchema } from "@apex14/validation";
import { db } from "./client.js";
import { ModelQuery, type FindOptions, type OrderDirection } from "./orm.js";
import {
  type RelationDefinition,
  type HasManyOptions,
  type BelongsToOptions,
  hasMany,
  belongsTo
} from "./relations.js";

export interface ModelOptions {
  timestamps?: boolean;
  softDelete?: boolean;
  client?: string;
  audit?: boolean;
  tenant?: boolean;
  relations?: Record<string, RelationDefinition>;
}

export function typeBoxToSqlType(propertySchema: any): string {
  if (!propertySchema) return "TEXT";
  const type = propertySchema.type;
  if (type === "integer") return "INTEGER";
  if (type === "number") return "REAL";
  if (type === "boolean") return "INTEGER";
  return "TEXT";
}

function notifyMutation(tableName: string, action: string, data?: any): void {
  const notify = (globalThis as any).__apex14_live_notify;
  if (typeof notify === "function") {
    try {
      notify(tableName, { action, data });
    } catch {
      // Safe ignore
    }
  }
}

function auditRecordChange(
  table: string,
  recordId: string | number,
  action: "create" | "update" | "delete",
  before?: any,
  after?: any
): void {
  const audit = (globalThis as any).__apex14_audit_engine;
  if (audit && typeof audit.recordChange === "function") {
    try {
      audit.recordChange({ table, recordId, action, before, after });
    } catch {
      // Safe ignore
    }
  }
}

export class Model<T = any> {
  public tableName: string;
  public schema?: TSchema;
  public options: ModelOptions;
  private initialized = false;
  private initPromise?: Promise<void>;
  private relations = new Map<string, RelationDefinition>();

  constructor(tableName: string, schema?: TSchema, options: ModelOptions = {}) {
    this.tableName = tableName.replace(/[^a-zA-Z0-9_]/g, "");
    this.schema = schema;
    this.options = { timestamps: true, softDelete: false, ...options };
    if (options.relations) {
      for (const [name, def] of Object.entries(options.relations)) {
        this.relations.set(name, def);
      }
    }
    // Trigger eager table creation
    this.ensureTable();
  }

  public hasMany(relationName: string, targetModel: any, options: HasManyOptions = {}): this {
    this.relations.set(relationName, hasMany(targetModel, options));
    return this;
  }

  public belongsTo(relationName: string, targetModel: any, options: BelongsToOptions = {}): this {
    this.relations.set(relationName, belongsTo(targetModel, options));
    return this;
  }

  public getRelation(relationName: string): RelationDefinition | undefined {
    return this.relations.get(relationName);
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

        const tenantEngine = (globalThis as any).__apex14_tenant_engine;
        if (tenantEngine && this.options.tenant !== false) {
          columns[tenantEngine.getColumn()] = "TEXT";
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
    q.setModel(this);
    if (this.options.softDelete) {
      q.where("deleted_at", "IS NULL", null);
    }
    const tenantEngine = (globalThis as any).__apex14_tenant_engine;
    if (tenantEngine && this.options.tenant !== false) {
      const activeTenant = tenantEngine.getCurrentId();
      if (activeTenant) {
        q.where(tenantEngine.getColumn(), activeTenant);
      }
    }
    return q;
  }

  public include(...relations: (string | string[])[]): ModelQuery<T> {
    return this.query().include(...relations);
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
    const tenantEngine = (globalThis as any).__apex14_tenant_engine;
    if (tenantEngine && this.options.tenant !== false) {
      const activeTenant = tenantEngine.getCurrentId();
      if (activeTenant && !payload[tenantEngine.getColumn()]) {
        payload[tenantEngine.getColumn()] = activeTenant;
      }
    }
    const created = await db<T>(this.tableName).create(payload);
    let result = created;
    if ((created as any).id !== undefined) {
      const full = await db<T>(this.tableName).findById((created as any).id);
      if (full) result = full;
    }
    notifyMutation(this.tableName, "create", result);
    if (this.options.audit) {
      auditRecordChange(this.tableName, (result as any).id || 1, "create", undefined, result);
    }
    return result;
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

    let updated: T | null = null;
    if (typeof idOrWhere === "string" || typeof idOrWhere === "number") {
      updated = await db<T>(this.tableName).updateById(idOrWhere, payload);
    } else {
      await this.query().where(idOrWhere).update(payload);
      updated = await this.query().where(idOrWhere).first();
    }
    notifyMutation(this.tableName, "update", updated);
    if (this.options.audit) {
      auditRecordChange(
        this.tableName,
        typeof idOrWhere === "number" || typeof idOrWhere === "string" ? idOrWhere : (updated as any)?.id || 1,
        "update",
        undefined,
        updated
      );
    }
    return updated;
  }

  public async delete(idOrWhere: string | number | Record<string, any>): Promise<boolean> {
    await this.ensureTable();
    let success = false;
    if (this.options.softDelete) {
      const now = new Date().toISOString();
      if (typeof idOrWhere === "string" || typeof idOrWhere === "number") {
        const res = await db<T>(this.tableName).where("id", idOrWhere).update({ deleted_at: now });
        success = res.rowsAffected > 0;
      } else {
        const res = await db<T>(this.tableName).where(idOrWhere).update({ deleted_at: now });
        success = res.rowsAffected > 0;
      }
    } else if (typeof idOrWhere === "string" || typeof idOrWhere === "number") {
      success = await db<T>(this.tableName).deleteById(idOrWhere);
    } else {
      const res = await db<T>(this.tableName).where(idOrWhere).delete();
      success = res.rowsAffected > 0;
    }
    if (success) {
      notifyMutation(this.tableName, "delete", { id: idOrWhere });
      if (this.options.audit) {
        auditRecordChange(
          this.tableName,
          typeof idOrWhere === "number" || typeof idOrWhere === "string" ? idOrWhere : 1,
          "delete"
        );
      }
    }
    return success;
  }

  public asOf(timestamp: string | Date): { findById: (id: string | number) => any; find: (id: string | number) => any } {
    const auditEngine = (globalThis as any).__apex14_audit_engine;
    return {
      findById: (id: string | number) => (auditEngine ? auditEngine.asOf(this.tableName, id, timestamp) : null),
      find: (id: string | number) => (auditEngine ? auditEngine.asOf(this.tableName, id, timestamp) : null)
    };
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
