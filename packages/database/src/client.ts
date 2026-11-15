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

export class PostgresDatabaseClient implements DatabaseClient {
  private connectionString: string;
  private pool: any;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
  }

  private async getPool(): Promise<any> {
    if (this.pool) return this.pool;
    try {
      // @ts-ignore
      const pgModule: any = await import("pg" as any);
      this.pool = new pgModule.Pool({ connectionString: this.connectionString });
      return this.pool;
    } catch {
      throw new Error(
        "PostgreSQL client requires the 'pg' package. Install it using: pnpm add pg @types/pg"
      );
    }
  }

  public async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const pool = await this.getPool();
    let idx = 1;
    const pgSql = sql.replace(/\?/g, () => `$${idx++}`);
    const res = await pool.query(pgSql, params);
    return res.rows as T[];
  }

  public async execute(
    sql: string,
    params: any[] = []
  ): Promise<{ rowsAffected: number; lastInsertRowid?: number | bigint }> {
    const pool = await this.getPool();
    let idx = 1;
    const pgSql = sql.replace(/\?/g, () => `$${idx++}`);
    const res = await pool.query(pgSql, params);
    return {
      rowsAffected: res.rowCount || 0,
      lastInsertRowid: res.rows?.[0]?.id
    };
  }

  public async transaction<T>(fn: (tx: DatabaseClient) => Promise<T>): Promise<T> {
    const pool = await this.getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const txClient: DatabaseClient = {
        query: (sql, params = []) => {
          let idx = 1;
          return client.query(sql.replace(/\?/g, () => `$${idx++}`), params).then((r: any) => r.rows);
        },
        execute: async (sql, params = []) => {
          let idx = 1;
          const r = await client.query(sql.replace(/\?/g, () => `$${idx++}`), params);
          return { rowsAffected: r.rowCount || 0 };
        },
        transaction: () => {
          throw new Error("Nested transactions not supported");
        },
        healthCheck: async () => true,
        close: async () => {}
      };
      const result = await fn(txClient);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const rows = await this.query("SELECT 1 as health");
      return rows.length > 0;
    } catch {
      return false;
    }
  }

  public async close(): Promise<void> {
    if (this.pool) await this.pool.end();
  }
}

export class MysqlDatabaseClient implements DatabaseClient {
  private connectionString: string;
  private pool: any;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
  }

  private async getPool(): Promise<any> {
    if (this.pool) return this.pool;
    try {
      // @ts-ignore
      const mysql: any = await import("mysql2/promise" as any);
      this.pool = mysql.createPool(this.connectionString);
      return this.pool;
    } catch {
      throw new Error(
        "MySQL client requires the 'mysql2' package. Install it using: pnpm add mysql2"
      );
    }
  }

  public async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const pool = await this.getPool();
    const [rows] = await pool.query(sql, params);
    return rows as T[];
  }

  public async execute(
    sql: string,
    params: any[] = []
  ): Promise<{ rowsAffected: number; lastInsertRowid?: number | bigint }> {
    const pool = await this.getPool();
    const [res] = await pool.execute(sql, params);
    return {
      rowsAffected: res.affectedRows || 0,
      lastInsertRowid: res.insertId
    };
  }

  public async transaction<T>(fn: (tx: DatabaseClient) => Promise<T>): Promise<T> {
    const pool = await this.getPool();
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const txClient: DatabaseClient = {
        query: async (sql, params = []) => {
          const [rows] = await connection.query(sql, params);
          return rows as any[];
        },
        execute: async (sql, params = []) => {
          const [res] = await connection.execute(sql, params);
          return { rowsAffected: res.affectedRows || 0, lastInsertRowid: res.insertId };
        },
        transaction: () => {
          throw new Error("Nested transactions not supported");
        },
        healthCheck: async () => true,
        close: async () => {}
      };
      const result = await fn(txClient);
      await connection.commit();
      return result;
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const rows = await this.query("SELECT 1 as health");
      return rows.length > 0;
    } catch {
      return false;
    }
  }

  public async close(): Promise<void> {
    if (this.pool) await this.pool.end();
  }
}

const dbClients = new Map<string, DatabaseClient>();
let defaultDb: DatabaseClient = new SqliteDatabaseClient(":memory:");

export type DatabaseConfig = string | DatabaseClient;

export function configureDatabase(config: DatabaseConfig, name: string = "default"): DatabaseClient {
  let client: DatabaseClient;
  if (typeof config === "string") {
    const urlStr = config.trim();
    if (urlStr.startsWith("sqlite:") || urlStr.endsWith(".db") || urlStr === ":memory:") {
      const loc = urlStr.replace(/^sqlite:\/\//, "").replace(/^sqlite:/, "");
      client = new SqliteDatabaseClient(loc || ":memory:");
    } else if (urlStr.startsWith("postgres:") || urlStr.startsWith("postgresql:")) {
      client = new PostgresDatabaseClient(urlStr);
    } else if (urlStr.startsWith("mysql:")) {
      client = new MysqlDatabaseClient(urlStr);
    } else {
      client = new SqliteDatabaseClient(urlStr);
    }
  } else {
    client = config;
  }

  if (name === "default" || name === "main") {
    defaultDb = client;
  }
  dbClients.set(name, client);
  return client;
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
