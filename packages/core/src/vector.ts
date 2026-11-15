export type VectorMetric = "cosine" | "dot" | "euclidean";

export interface VectorIndexOptions {
  dimensions: number;
  metric?: VectorMetric;
}

export interface VectorRecord<TMeta = any> {
  id: string;
  vector: number[] | Float32Array;
  metadata?: TMeta;
}

export interface VectorSearchResult<TMeta = any> {
  id: string;
  score: number;
  metadata?: TMeta;
}

export interface VectorSearchOptions {
  topK?: number;
  minScore?: number;
  filter?: Record<string, any>;
}

function dotProduct(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i]! * b[i]!;
  }
  return sum;
}

function magnitude(v: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < v.length; i++) {
    sum += v[i]! * v[i]!;
  }
  return Math.sqrt(sum);
}

function euclideanDistance(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i]! - b[i]!;
    sum += d * d;
  }
  return Math.sqrt(sum);
}

export class ApexVectorIndex<TMeta = any> {
  public readonly dimensions: number;
  public readonly metric: VectorMetric;
  private records = new Map<string, VectorRecord<TMeta>>();

  constructor(options: VectorIndexOptions) {
    if (!options.dimensions || options.dimensions <= 0) {
      throw new Error("Vector index dimensions must be greater than 0");
    }
    this.dimensions = options.dimensions;
    this.metric = options.metric || "cosine";
  }

  public upsert(id: string, vector: number[] | Float32Array, metadata?: TMeta): void {
    if (vector.length !== this.dimensions) {
      throw new Error(`Vector dimension mismatch: expected ${this.dimensions}, got ${vector.length}`);
    }
    this.records.set(id, { id, vector, metadata });
  }

  public upsertMany(records: Array<{ id: string; vector: number[] | Float32Array; metadata?: TMeta }>): void {
    for (const r of records) {
      this.upsert(r.id, r.vector, r.metadata);
    }
  }

  public delete(id: string): boolean {
    return this.records.delete(id);
  }

  public get(id: string): VectorRecord<TMeta> | undefined {
    return this.records.get(id);
  }

  public size(): number {
    return this.records.size;
  }

  public clear(): void {
    this.records.clear();
  }

  public search(
    queryVector: number[] | Float32Array,
    options: VectorSearchOptions = {}
  ): VectorSearchResult<TMeta>[] {
    if (queryVector.length !== this.dimensions) {
      throw new Error(`Query vector dimension mismatch: expected ${this.dimensions}, got ${queryVector.length}`);
    }

    const topK = options.topK || 10;
    const minScore = options.minScore !== undefined ? options.minScore : -Infinity;
    const filter = options.filter;

    const queryMag = this.metric === "cosine" ? magnitude(queryVector) : 1;
    const scored: VectorSearchResult<TMeta>[] = [];

    for (const record of this.records.values()) {
      // Check metadata filter
      if (filter && record.metadata) {
        let match = true;
        for (const [k, v] of Object.entries(filter)) {
          if ((record.metadata as any)[k] !== v) {
            match = false;
            break;
          }
        }
        if (!match) continue;
      }

      let score = 0;
      if (this.metric === "cosine") {
        const dot = dotProduct(queryVector, record.vector);
        const recordMag = magnitude(record.vector);
        score = queryMag && recordMag ? dot / (queryMag * recordMag) : 0;
      } else if (this.metric === "dot") {
        score = dotProduct(queryVector, record.vector);
      } else if (this.metric === "euclidean") {
        const dist = euclideanDistance(queryVector, record.vector);
        score = 1 / (1 + dist); // Convert distance to similarity in range (0, 1]
      }

      if (score >= minScore) {
        scored.push({
          id: record.id,
          score,
          metadata: record.metadata
        });
      }
    }

    // Sort descending by score
    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, topK);
  }
}

export class ApexVectorEngine {
  public index<TMeta = any>(options: VectorIndexOptions): ApexVectorIndex<TMeta> {
    return new ApexVectorIndex<TMeta>(options);
  }
}

export const vector = new ApexVectorEngine();
