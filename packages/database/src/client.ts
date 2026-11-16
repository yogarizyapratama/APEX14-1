import { createRequire } from "node:module";
import { ModelQuery } from "./orm.js";

const require = createRequire(import.meta.url);
let DatabaseSync: any;
try {
  const sqliteMod = require("node:sqlite");
  DatabaseSync = sqliteMod.DatabaseSync;
} catch {
  // If not in Node 22+ with node:sqlite, provide fallback
}

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
    if (!DatabaseSync) {
      const sqliteMod = require("node:sqlite");
      DatabaseSync = sqliteMod.DatabaseSync;
    }
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

export interface PostgresConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean | any;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
  pool?: any; // Mock or custom pool injection for tests
}

export class PostgresDatabaseClient implements DatabaseClient {
  private config: PostgresConfig;
  private pool: any;

  constructor(configOrUrl: string | PostgresConfig) {
    if (typeof configOrUrl === "string") {
      this.config = { connectionString: configOrUrl };
    } else {
      this.config = configOrUrl;
    }
    if (this.config.pool) {
      this.pool = this.config.pool;
    }
  }

  private async getPool(): Promise<any> {
    if (this.pool) return this.pool;
    try {
      // @ts-ignore
      const pgModule: any = await import("pg" as any);
      const Pool = pgModule.Pool || pgModule.default?.Pool;
      this.pool = new Pool(
        this.config.connectionString
          ? { connectionString: this.config.connectionString }
          : this.config
      );
      return this.pool;
    } catch (err: any) {
      throw new Error(
        `PostgreSQL client requires the 'pg' package. Install it using: pnpm add pg @types/pg (${err.message})`
      );
    }
  }

  public async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const pool = await this.getPool();
    let idx = 1;
    const pgSql = sql.replace(/\?/g, () => `$${idx++}`);
    const res = await pool.query(pgSql, params);
    return (res.rows || res) as T[];
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
      rowsAffected: res.rowCount ?? (Array.isArray(res) ? res.length : 0),
      lastInsertRowid: res.rows?.[0]?.id
    };
  }

  public async transaction<T>(fn: (tx: DatabaseClient) => Promise<T>): Promise<T> {
    const pool = await this.getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const txClient: DatabaseClient = {
        query: async (sql, params = []) => {
          let idx = 1;
          const r = await client.query(sql.replace(/\?/g, () => `$${idx++}`), params);
          return (r.rows || r) as any[];
        },
        execute: async (sql, params = []) => {
          let idx = 1;
          const r = await client.query(sql.replace(/\?/g, () => `$${idx++}`), params);
          return { rowsAffected: r.rowCount ?? 0 };
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
      if (typeof client.release === "function") {
        client.release();
      }
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
    if (this.pool && typeof this.pool.end === "function") {
      await this.pool.end();
    }
  }
}

export interface MysqlConfig {
  uri?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  connectionLimit?: number;
  ssl?: any;
  pool?: any; // Mock or custom pool injection for tests
}

export class MysqlDatabaseClient implements DatabaseClient {
  private config: MysqlConfig;
  private pool: any;

  constructor(configOrUrl: string | MysqlConfig) {
    if (typeof configOrUrl === "string") {
      this.config = { uri: configOrUrl };
    } else {
      this.config = configOrUrl;
    }
    if (this.config.pool) {
      this.pool = this.config.pool;
    }
  }

  private async getPool(): Promise<any> {
    if (this.pool) return this.pool;
    try {
      // @ts-ignore
      const mysql: any = await import("mysql2/promise" as any);
      const createPool = mysql.createPool || mysql.default?.createPool;
      this.pool = createPool(this.config.uri || this.config);
      return this.pool;
    } catch (err: any) {
      throw new Error(
        `MySQL client requires the 'mysql2' package. Install it using: pnpm add mysql2 (${err.message})`
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
      if (typeof connection.release === "function") {
        connection.release();
      }
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
    if (this.pool && typeof this.pool.end === "function") {
      await this.pool.end();
    }
  }
}

const dbClients = new Map<string, DatabaseClient>();
let defaultDb: DatabaseClient = new SqliteDatabaseClient(":memory:");

export type DatabaseConfig =
  | string
  | DatabaseClient
  | ({ type: "postgres" | "postgresql" } & PostgresConfig)
  | ({ type: "mysql" | "mysql2" } & MysqlConfig)
  | ({ type: "sqlite" } & { path?: string });

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
  } else if (typeof (config as any).query === "function") {
    client = config as DatabaseClient;
  } else {
    const obj = config as any;
    if (obj.type === "postgres" || obj.type === "postgresql") {
      client = new PostgresDatabaseClient(obj);
    } else if (obj.type === "mysql" || obj.type === "mysql2") {
      client = new MysqlDatabaseClient(obj);
    } else {
      client = new SqliteDatabaseClient(obj.path || ":memory:");
    }
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
    getTableColumns(tableName: string): Promise<string[]>;
    addColumn(tableName: string, column: string, type: string): Promise<void>;
    listTables(): Promise<string[]>;
  };
}

export const db: DbInterface = Object.assign(
  function <T = any>(tableOrClientName: string): any {
    // If it's a registered client name, return that client
    if (dbClients.has(tableOrClientName)) {
      return dbClients.get(tableOrClientName)!;
    }
    // Otherwise return a ModelQuery for defaultDb
    return new ModelQuery<T>(tableOrClientName, defaultDb);
  },
  {
    table: <T = any>(tableName: string, clientName: string = "default") => {
      const client = dbClients.get(clientName) || defaultDb;
      return new ModelQuery<T>(tableName, client);
    },
    model: <T = any>(tableName: string, schema?: any, options?: any) => {
      // Lazy import or delegate to model constructor
      const { model: createModel } = require("./model.js");
      return createModel(tableName, schema, options);
    },
    client: (name: string = "default") => {
      const c = dbClients.get(name);
      if (!c) {
        if (name === "default") return defaultDb;
        throw new Error(`Database client '${name}' not configured`);
      }
      return c;
    },
    query: async <T = any>(sql: string, params: any[] = []): Promise<T[]> => {
      return await defaultDb.query<T>(sql, params);
    },
    execute: async (
      sql: string,
      params: any[] = []
    ): Promise<{ rowsAffected: number; lastInsertRowid?: number | bigint }> => {
      return await defaultDb.execute(sql, params);
    },
    raw: async <T = any>(sql: string, params: any[] = []): Promise<T[]> => {
      return await defaultDb.query<T>(sql, params);
    },
    transaction: async <T>(fn: (tx: DatabaseClient) => Promise<T>): Promise<T> => {
      return await defaultDb.transaction(fn);
    },
    schema: {
      createTableIfNotExists: async (
        tableName: string,
        columns: Record<string, string>
      ): Promise<void> => {
        const safeTable = tableName.replace(/[^a-zA-Z0-9_]/g, "");
        const colDefs = Object.entries(columns)
          .map(([col, type]) => `"${col.replace(/[^a-zA-Z0-9_]/g, "")}" ${type}`)
          .join(", ");
        await defaultDb.execute(`CREATE TABLE IF NOT EXISTS "${safeTable}" (${colDefs})`);
      },
      dropTableIfExists: async (tableName: string): Promise<void> => {
        const safeTable = tableName.replace(/[^a-zA-Z0-9_]/g, "");
        await defaultDb.execute(`DROP TABLE IF EXISTS "${safeTable}"`);
      },
      getTableColumns: async (tableName: string): Promise<string[]> => {
        try {
          const rows = await defaultDb.query(`PRAGMA table_info("${tableName.replace(/[^a-zA-Z0-9_]/g, "")}")`);
          return rows.map((r: any) => r.name);
        } catch {
          return [];
        }
      },
      addColumn: async (tableName: string, column: string, type: string): Promise<void> => {
        const safeTable = tableName.replace(/[^a-zA-Z0-9_]/g, "");
        const safeCol = column.replace(/[^a-zA-Z0-9_]/g, "");
        await defaultDb.execute(`ALTER TABLE "${safeTable}" ADD COLUMN "${safeCol}" ${type}`);
      },
      listTables: async (): Promise<string[]> => {
        try {
          const rows = await defaultDb.query(
            `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
          );
          return rows.map((r: any) => r.name);
        } catch {
          return [];
        }
      }
    }
  }
);
