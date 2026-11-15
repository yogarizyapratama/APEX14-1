import { createRequire } from "node:module";
import { ModelQuery } from "./orm.js";

const require = createRequire(import.meta.url);
const { DatabaseSync } = require("node:sqlite");

export interface QueryResult<T = any> {
  rows: T[];
  rowsAffected?: number;
  lastInsertRowid?: number | bigint;
}

export interface DatabaseClient {
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  execute(sql: string, params?: any[]): Promise<{ rowsAffected: number; lastInsertRowid?: number | bigint }>;
  transaction<T>(fn: (tx: DatabaseClient) => Promise<T>): Promise<T>;
  healthCheck(): Promise<boolean>;
  close(): Promise<void>;
}

export class SqliteDatabaseClient implements DatabaseClient {
  private db: any;

  constructor(location: string = ":memory:") {
    this.db = new DatabaseSync(location);
  }

  public async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params);
    return rows as T[];
  }

  public async execute(
    sql: string,
    params: any[] = []
  ): Promise<{ rowsAffected: number; lastInsertRowid?: number | bigint }> {
    const stmt = this.db.prepare(sql);
    const result = stmt.run(...params);
    return {
      rowsAffected: Number(result.changes),
      lastInsertRowid: result.lastInsertRowid
    };
  }

  public async transaction<T>(fn: (tx: DatabaseClient) => Promise<T>): Promise<T> {
    this.db.exec("BEGIN");
    try {
      const res = await fn(this);
      this.db.exec("COMMIT");
      return res;
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const res = await this.query("SELECT 1 as health");
      return res.length > 0 && (res[0] as any).health === 1;
    } catch {
      return false;
    }
  }

  public async close(): Promise<void> {
    this.db.close();
  }
}

const dbClients = new Map<string, DatabaseClient>();
let defaultDb: DatabaseClient = new SqliteDatabaseClient(":memory:");

export function configureDatabase(client: DatabaseClient, name: string = "default"): void {
  if (name === "default" || name === "main") {
    defaultDb = client;
  }
  dbClients.set(name, client);
}

export interface DbInterface {
  <T = any>(tableOrClientName: string): ModelQuery<T>;
  table<T = any>(tableName: string, clientName?: string): ModelQuery<T>;
  model<T = any>(tableName: string, schema?: any, options?: any): any;
  client(name?: string): DatabaseClient;
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  execute(sql: string, params?: any[]): Promise<{ rowsAffected: number; lastInsertRowid?: number | bigint }>;
  raw<T = any>(sql: string, params?: any[]): Promise<T[]>;
  transaction<T>(fn: (tx: DatabaseClient) => Promise<T>): Promise<T>;
  schema: {
    createTableIfNotExists(
      tableName: string,
      columns: Record<string, string>
    ): Promise<void>;
    dropTableIfExists(tableName: string): Promise<void>;
  };
}

export const db: DbInterface = Object.assign(
  function <T = any>(tableOrClientName: string): any {
    // If it's a registered client name, return that client
    if (dbClients.has(tableOrClientName)) {
      return dbClients.get(tableOrClientName)!;
    }
    // Otherwise, treat as table name and return an ORM query builder!
    return new ModelQuery<T>(tableOrClientName, defaultDb);
  },
  {
    table<T = any>(tableName: string, clientName?: string): ModelQuery<T> {
      const client = clientName ? (dbClients.get(clientName) || defaultDb) : defaultDb;
      return new ModelQuery<T>(tableName, client);
    },

    model<T = any>(tableName: string, schema?: any, options?: any): any {
      const fn = (db as any)._modelFactory;
      if (typeof fn === "function") {
        return fn(tableName, schema, options);
      }
      throw new Error("Model factory not initialized. Import 'model' from '@apex14/database'.");
    },

    client(name: string = "default"): DatabaseClient {
      if (name === "default" || name === "main") return defaultDb;
      const found = dbClients.get(name);
      if (!found) throw new Error(`Database client '${name}' not found`);
      return found;
    },

    query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
      return defaultDb.query<T>(sql, params);
    },

    raw<T = any>(sql: string, params: any[] = []): Promise<T[]> {
      return defaultDb.query<T>(sql, params);
    },

    execute(sql: string, params: any[] = []): Promise<{ rowsAffected: number; lastInsertRowid?: number | bigint }> {
      return defaultDb.execute(sql, params);
    },

    transaction<T>(fn: (tx: DatabaseClient) => Promise<T>): Promise<T> {
      return defaultDb.transaction<T>(fn);
    },

    schema: {
      async createTableIfNotExists(
        tableName: string,
        columns: Record<string, string>
      ): Promise<void> {
        const safeTable = tableName.replace(/[^a-zA-Z0-9_]/g, "");
        const colDefs = Object.entries(columns)
          .map(([col, type]) => `"${col.replace(/[^a-zA-Z0-9_]/g, "")}" ${type}`)
          .join(", ");
        const sql = `CREATE TABLE IF NOT EXISTS "${safeTable}" (${colDefs})`;
        await defaultDb.execute(sql);
      },

      async dropTableIfExists(tableName: string): Promise<void> {
        const safeTable = tableName.replace(/[^a-zA-Z0-9_]/g, "");
        await defaultDb.execute(`DROP TABLE IF EXISTS "${safeTable}"`);
      }
    }
  }
);
