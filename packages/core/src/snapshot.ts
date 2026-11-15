import { ApexError } from "@apex14/http";

export interface SnapshotOptions {
  ignoreDynamic?: string[];
  update?: boolean;
}

export class SnapshotMismatchError extends ApexError {
  public readonly differences: string[];

  constructor(key: string, differences: string[]) {
    const summary = differences.slice(0, 5).join("\n  • ");
    super(
      500,
      `Snapshot mismatch for key '${key}':\n  • ${summary}${differences.length > 5 ? `\n  ... and ${differences.length - 5} more` : ""}`,
      "SNAPSHOT_MISMATCH"
    );
    this.name = "SnapshotMismatchError";
    this.differences = differences;
  }
}

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class ApexSnapshotEngine {
  private snapshots = new Map<string, any>();

  public maskSemantic(data: any, options: SnapshotOptions = {}): any {
    if (data === null || data === undefined) return data;

    const ignoreKeys = new Set((options.ignoreDynamic || []).map((k) => k.toLowerCase()));

    const maskValue = (val: any, keyHint = ""): any => {
      if (keyHint && ignoreKeys.has(keyHint.toLowerCase())) {
        return "<DYNAMIC_VALUE>";
      }

      if (typeof val === "string") {
        if (ISO_DATE_REGEX.test(val)) return "<ISO_DATE>";
        if (UUID_REGEX.test(val)) return "<UUID>";
        return val;
      }

      if (Array.isArray(val)) {
        return val.map((item) => maskValue(item));
      }

      if (typeof val === "object" && val !== null) {
        const maskedObj: Record<string, any> = {};
        for (const [k, v] of Object.entries(val)) {
          maskedObj[k] = maskValue(v, k);
        }
        return maskedObj;
      }

      return val;
    };

    return maskValue(data);
  }

  public diff(expected: any, actual: any, path = ""): string[] {
    const diffs: string[] = [];

    if (expected === actual) return diffs;

    if (typeof expected !== typeof actual) {
      diffs.push(`Type mismatch at '${path || "/"}': expected type '${typeof expected}', received '${typeof actual}'`);
      return diffs;
    }

    if (Array.isArray(expected) && Array.isArray(actual)) {
      if (expected.length !== actual.length) {
        diffs.push(`Array length mismatch at '${path || "/"}': expected ${expected.length}, received ${actual.length}`);
      }
      const min = Math.min(expected.length, actual.length);
      for (let i = 0; i < min; i++) {
        diffs.push(...this.diff(expected[i], actual[i], `${path}/${i}`));
      }
      return diffs;
    }

    if (typeof expected === "object" && expected !== null && actual !== null) {
      const expKeys = Object.keys(expected);
      const actKeys = Object.keys(actual);

      for (const k of expKeys) {
        if (!(k in actual)) {
          diffs.push(`Missing property at '${path}/${k}'`);
        } else {
          diffs.push(...this.diff(expected[k], actual[k], `${path}/${k}`));
        }
      }

      for (const k of actKeys) {
        if (!(k in expected)) {
          diffs.push(`Unexpected property at '${path}/${k}'`);
        }
      }
      return diffs;
    }

    diffs.push(`Value mismatch at '${path || "/"}': expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
    return diffs;
  }

  public verify(key: string, actualData: any, options: SnapshotOptions = {}): { match: boolean; diff?: string } {
    const maskedActual = this.maskSemantic(actualData, options);

    if (!this.snapshots.has(key) || options.update) {
      this.snapshots.set(key, maskedActual);
      return { match: true };
    }

    const baseline = this.snapshots.get(key);
    const diffs = this.diff(baseline, maskedActual);

    if (diffs.length > 0) {
      throw new SnapshotMismatchError(key, diffs);
    }

    return { match: true };
  }

  public get(key: string): any {
    return this.snapshots.get(key);
  }

  public set(key: string, data: any): void {
    this.snapshots.set(key, data);
  }

  public clear(): void {
    this.snapshots.clear();
  }
}

export const snapshot = new ApexSnapshotEngine();
