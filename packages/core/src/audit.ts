export interface AuditRecord {
  id: string;
  table: string;
  recordId: string | number;
  action: "create" | "update" | "delete";
  diff: Record<string, { before?: any; after?: any }>;
  snapshot: any;
  changedBy?: string;
  timestamp: string;
  sequence: number;
  ip?: string;
}

export class ApexAuditEngine {
  private records: AuditRecord[] = [];
  private sequenceCounter = 0;
  public enabled = true;

  constructor() {
    (globalThis as any).__apex14_audit_engine = this;
  }

  public recordChange(entry: {
    table: string;
    recordId: string | number;
    action: "create" | "update" | "delete";
    before?: any;
    after?: any;
    changedBy?: string;
    ip?: string;
  }): AuditRecord {
    const diff: Record<string, { before?: any; after?: any }> = {};

    if (entry.action === "create") {
      for (const [k, v] of Object.entries(entry.after || {})) {
        diff[k] = { after: v };
      }
    } else if (entry.action === "delete") {
      for (const [k, v] of Object.entries(entry.before || {})) {
        diff[k] = { before: v };
      }
    } else if (entry.action === "update") {
      const allKeys = new Set([...Object.keys(entry.before || {}), ...Object.keys(entry.after || {})]);
      for (const k of allKeys) {
        const b = entry.before?.[k];
        const a = entry.after?.[k];
        if (b !== a) {
          diff[k] = { before: b, after: a };
        }
      }
    }

    const record: AuditRecord = {
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      table: entry.table,
      recordId: entry.recordId,
      action: entry.action,
      diff,
      snapshot: entry.after || entry.before,
      changedBy: entry.changedBy,
      timestamp: new Date().toISOString(),
      sequence: ++this.sequenceCounter,
      ip: entry.ip
    };

    this.records.unshift(record);
    if (this.records.length > 5000) {
      this.records.pop();
    }

    return record;
  }

  public getHistory(table: string, recordId: string | number): AuditRecord[] {
    return this.records.filter((r) => r.table === table && String(r.recordId) === String(recordId));
  }

  public asOf(table: string, recordId: string | number, timestamp: string | Date): any | null {
    const targetMs = typeof timestamp === "string" ? new Date(timestamp).getTime() : timestamp.getTime();
    const history = this.records
      .filter((r) => r.table === table && String(r.recordId) === String(recordId))
      .sort((a, b) => {
        const diff = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        return diff !== 0 ? diff : a.sequence - b.sequence;
      });

    if (history.length === 0) return null;

    let snapshot: any = null;
    for (const record of history) {
      const recMs = new Date(record.timestamp).getTime();
      if (recMs <= targetMs) {
        if (record.action === "delete") {
          snapshot = null;
        } else {
          snapshot = { ...(snapshot || {}), ...(record.snapshot || {}) };
        }
      } else {
        break;
      }
    }

    return snapshot;
  }

  public clear(): void {
    this.records = [];
    this.sequenceCounter = 0;
  }
}

export const audit = new ApexAuditEngine();
