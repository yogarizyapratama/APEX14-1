export interface MockOptions {
  seed?: number;
  overrides?: Record<string, any>;
  arrayLength?: number;
}

function createPrng(seed?: number): () => number {
  if (seed === undefined) {
    return Math.random;
  }
  let s = seed >>> 0;
  return function mulberry32() {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SAMPLE_NAMES = ["Alex Rivera", "Jordan Smith", "Morgan Lee", "Taylor Swift", "Casey Chen", "Sam Wilson"];
const SAMPLE_CITIES = ["San Francisco", "Tokyo", "London", "Berlin", "Singapore", "New York"];
const SAMPLE_COMPANIES = ["Acme Corp", "Apex Technologies", "Cyberdyne", "Wayne Enterprises", "Stark Industries"];

export class ApexMockEngine {
  public generate(schema: any, options: MockOptions = {}, fieldHint = ""): any {
    const rand = createPrng(options.seed);
    return this.generateInternal(schema, rand, options, fieldHint);
  }

  private generateInternal(schema: any, rand: () => number, options: MockOptions, fieldHint: string): any {
    if (!schema || typeof schema !== "object") {
      return null;
    }

    // Literal / Const
    if ("const" in schema) {
      return schema.const;
    }

    // Enum
    if (Array.isArray(schema.enum) && schema.enum.length > 0) {
      const idx = Math.floor(rand() * schema.enum.length);
      return schema.enum[idx];
    }

    // Union (anyOf / oneOf)
    const unionOptions = schema.anyOf || schema.oneOf;
    if (Array.isArray(unionOptions) && unionOptions.length > 0) {
      const chosen = unionOptions[Math.floor(rand() * unionOptions.length)];
      return this.generateInternal(chosen, rand, options, fieldHint);
    }

    // Determine type
    const type = schema.type;

    if (type === "string") {
      // Formats
      if (schema.format === "email") {
        const id = Math.floor(rand() * 9000 + 1000);
        return `user${id}@example.com`;
      }
      if (schema.format === "uuid") {
        return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
          (parseInt(c, 10) ^ (Math.floor(rand() * 16) >> (parseInt(c, 10) / 4))).toString(16)
        );
      }
      if (schema.format === "date-time" || schema.format === "date") {
        const base = 1773000000000;
        const offset = Math.floor(rand() * 100000000);
        return new Date(base + offset).toISOString();
      }
      if (schema.format === "url" || schema.format === "uri") {
        const id = Math.floor(rand() * 9000 + 1000);
        return `https://example.com/resource/${id}`;
      }
      if (schema.format === "ipv4") {
        return `192.168.${Math.floor(rand() * 254 + 1)}.${Math.floor(rand() * 254 + 1)}`;
      }

      // Field hints
      const hint = fieldHint.toLowerCase();
      if (hint.includes("email")) {
        const id = Math.floor(rand() * 9000 + 1000);
        return `user${id}@example.com`;
      }
      if (hint.includes("name") && !hint.includes("file") && !hint.includes("user")) {
        return SAMPLE_NAMES[Math.floor(rand() * SAMPLE_NAMES.length)];
      }
      if (hint.includes("city")) {
        return SAMPLE_CITIES[Math.floor(rand() * SAMPLE_CITIES.length)];
      }
      if (hint.includes("company")) {
        return SAMPLE_COMPANIES[Math.floor(rand() * SAMPLE_COMPANIES.length)];
      }
      if (hint.includes("avatar") || hint.includes("image")) {
        return `https://images.unsplash.com/photo-${Math.floor(rand() * 1000000)}`;
      }
      if (hint.includes("id")) {
        return `id_${Math.floor(rand() * 900000 + 100000)}`;
      }

      return `mock_${Math.floor(rand() * 10000)}`;
    }

    if (type === "number" || type === "integer") {
      const min = typeof schema.minimum === "number" ? schema.minimum : 1;
      const max = typeof schema.maximum === "number" ? schema.maximum : 100;
      const val = min + rand() * (max - min);
      return type === "integer" ? Math.round(val) : Math.round(val * 100) / 100;
    }

    if (type === "boolean") {
      return rand() > 0.5;
    }

    if (type === "array") {
      const len = options.arrayLength !== undefined ? options.arrayLength : Math.floor(rand() * 3 + 1);
      const itemsSchema = schema.items || { type: "string" };
      const arr: any[] = [];
      for (let i = 0; i < len; i++) {
        arr.push(this.generateInternal(itemsSchema, rand, options, fieldHint));
      }
      return arr;
    }

    if (type === "object" || schema.properties) {
      const obj: Record<string, any> = {};
      const props = schema.properties || {};
      for (const [key, propSchema] of Object.entries(props)) {
        if (options.overrides && key in options.overrides) {
          obj[key] = options.overrides[key];
        } else {
          obj[key] = this.generateInternal(propSchema, rand, options, key);
        }
      }
      return obj;
    }

    return null;
  }

  public one<T = any>(schema: any, options: MockOptions = {}): T {
    const result = this.generate(schema, options);
    if (options.overrides && typeof result === "object" && result !== null) {
      return { ...result, ...options.overrides };
    }
    return result;
  }

  public many<T = any>(schema: any, count: number = 3, options: MockOptions = {}): T[] {
    const list: T[] = [];
    const baseSeed = options.seed !== undefined ? options.seed : Math.floor(Math.random() * 1000000);
    for (let i = 0; i < count; i++) {
      list.push(this.one<T>(schema, { ...options, seed: baseSeed + i * 17 }));
    }
    return list;
  }

  public fn<T = any>(schema: any, options: MockOptions = {}) {
    return async () => this.one<T>(schema, options);
  }
}

export const mock = new ApexMockEngine();
