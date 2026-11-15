export type SqlDialect = "sqlite" | "postgres" | "mysql";

export interface MigrationPlan {
  tableName: string;
  isNewTable: boolean;
  missingColumns: Array<{ name: string; type: string }>;
  sqlStatements: string[];
}

function mapTypeBoxToSql(schema: any, dialect: SqlDialect = "sqlite"): string {
  if (!schema || typeof schema !== "object") return "TEXT";

  const type = schema.type;
  if (type === "string") {
    if (schema.format === "date-time") return dialect === "postgres" ? "TIMESTAMPTZ" : "TEXT";
    if (schema.format === "uuid") return dialect === "postgres" ? "UUID" : "TEXT";
    return "TEXT";
  }
  if (type === "integer") {
    return dialect === "postgres" ? "INTEGER" : "INTEGER";
  }
  if (type === "number") {
    return dialect === "sqlite" ? "REAL" : "DOUBLE PRECISION";
  }
  if (type === "boolean") {
    return dialect === "sqlite" ? "INTEGER" : "BOOLEAN";
  }
  if (type === "array" || type === "object") {
    return dialect === "postgres" ? "JSONB" : "TEXT";
  }
  return "TEXT";
}

export class ApexMigrateEngine {
  private registeredModels = new Map<string, any>();

  public register(tableName: string, schema: any): void {
    this.registeredModels.set(tableName, schema);
  }

  public diffColumns(existingColumns: string[], targetSchema: any): string[] {
    const targetProps = targetSchema?.properties ? Object.keys(targetSchema.properties) : [];
    const existingSet = new Set(existingColumns.map((c) => c.toLowerCase()));
    return targetProps.filter((col) => !existingSet.has(col.toLowerCase()));
  }

  public plan(
    tableName: string,
    existingColumns: string[] | null,
    targetSchema: any,
    dialect: SqlDialect = "sqlite"
  ): MigrationPlan {
    const isNewTable = existingColumns === null || existingColumns.length === 0;
    const missingColNames = isNewTable ? [] : this.diffColumns(existingColumns, targetSchema);
    const sqlStatements: string[] = [];
    const missingColumns: Array<{ name: string; type: string }> = [];

    const props = targetSchema?.properties || {};

    if (isNewTable) {
      const colDefs: string[] = [];
      for (const [colName, colSchema] of Object.entries(props)) {
        const sqlType = mapTypeBoxToSql(colSchema, dialect);
        if (colName === "id") {
          colDefs.push(dialect === "sqlite" ? "id TEXT PRIMARY KEY" : "id VARCHAR(255) PRIMARY KEY");
        } else {
          colDefs.push(`${colName} ${sqlType}`);
        }
      }
      if (colDefs.length > 0) {
        sqlStatements.push(`CREATE TABLE IF NOT EXISTS "${tableName}" (${colDefs.join(", ")});`);
      }
    } else {
      for (const colName of missingColNames) {
        const colSchema = props[colName];
        const sqlType = mapTypeBoxToSql(colSchema, dialect);
        missingColumns.push({ name: colName, type: sqlType });
        sqlStatements.push(`ALTER TABLE "${tableName}" ADD COLUMN "${colName}" ${sqlType};`);
      }
    }

    return {
      tableName,
      isNewTable,
      missingColumns,
      sqlStatements
    };
  }

  public async sync(
    dbClient: { query: (sql: string) => Promise<any> | any },
    dialect: SqlDialect = "sqlite"
  ): Promise<string[]> {
    const executed: string[] = [];
    for (const [tableName, schema] of this.registeredModels.entries()) {
      // In a real execution, existing columns would be retrieved from pragma/information_schema
      const plan = this.plan(tableName, null, schema, dialect);
      for (const sql of plan.sqlStatements) {
        await dbClient.query(sql);
        executed.push(sql);
      }
    }
    return executed;
  }

  public clear(): void {
    this.registeredModels.clear();
  }
}

export const migrate = new ApexMigrateEngine();
