import { createRequire } from "node:module";

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

export function db(name: string = "default"): DatabaseClient {
  if (name === "default" || name === "main") {
    return defaultDb;
  }
  const existing = dbClients.get(name);
  if (!existing) {
    throw new Error(`Database '${name}' is not configured`);
  }
  return existing;
}
