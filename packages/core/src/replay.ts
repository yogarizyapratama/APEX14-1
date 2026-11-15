import { ApexRequestContext, ApexError } from "@apex14/http";
import { getActiveScope, type ApexScope } from "./scope.js";
import type { Middleware } from "./types.js";

export interface ReplayCassette {
  id: string;
  timestamp: number;
  durationMs: number;
  request: {
    method: string;
    url: string;
    pathname: string;
    headers: Record<string, string>;
    query: Record<string, string>;
    body?: any;
  };
  response?: {
    status: number;
    headers: Record<string, string>;
    body?: any;
  };
  error?: {
    message: string;
    code?: string;
    status?: number;
  };
}

export interface ReplayRecordOptions {
  sampleRate?: number; // 0.0 - 1.0 (default 1.0)
  recordOnError?: boolean; // if true, only records when request results in error or status >= 400
  maskHeaders?: string[]; // headers to redact (e.g. authorization)
}

export class ApexReplayEngine {
  private cassettes = new Map<string, ReplayCassette>();

  public record(options: ReplayRecordOptions = {}): Middleware {
    const sampleRate = options.sampleRate !== undefined ? options.sampleRate : 1.0;
    const maskHeaders = new Set((options.maskHeaders || ["authorization", "cookie"]).map((h) => h.toLowerCase()));

    return async (ctx: ApexRequestContext, next: () => Promise<any>) => {
      // Sample rate check
      if (sampleRate < 1.0 && Math.random() > sampleRate) {
        return await next();
      }

      const startTime = Date.now();
      const cassetteId = `tape_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      // Redact sensitive headers
      const sanitizedHeaders: Record<string, string> = {};
      for (const [k, v] of Object.entries(ctx.headers)) {
        sanitizedHeaders[k] = maskHeaders.has(k.toLowerCase()) ? "[REDACTED]" : v;
      }

      const cassette: ReplayCassette = {
        id: cassetteId,
        timestamp: startTime,
        durationMs: 0,
        request: {
          method: ctx.request.method,
          url: ctx.request.url,
          pathname: ctx.url.pathname,
          headers: sanitizedHeaders,
          query: ctx.query,
          body: ctx.body
        }
      };

      try {
        const result = await next();
        cassette.durationMs = Date.now() - startTime;
        const resHeaders: Record<string, string> = {};
        ctx.responseHeaders.forEach((v, k) => {
          resHeaders[k] = v;
        });

        cassette.response = {
          status: ctx.responseStatus || 200,
          headers: resHeaders,
          body: result
        };

        if (!options.recordOnError || (ctx.responseStatus && ctx.responseStatus >= 400)) {
          this.cassettes.set(cassetteId, cassette);
        }

        return result;
      } catch (err: any) {
        cassette.durationMs = Date.now() - startTime;
        cassette.error = {
          message: err.message,
          code: err.code || "INTERNAL_ERROR",
          status: err instanceof ApexError ? err.status : 500
        };
        this.cassettes.set(cassetteId, cassette);
        throw err;
      }
    };
  }

  public getTape(id: string): ReplayCassette | undefined {
    return this.cassettes.get(id);
  }

  public allTapes(): ReplayCassette[] {
    return Array.from(this.cassettes.values());
  }

  public async playback(
    cassetteOrId: string | ReplayCassette,
    targetScope: ApexScope = getActiveScope()
  ): Promise<{ status: number; body: any; headers: Headers }> {
    const cassette = typeof cassetteOrId === "string" ? this.cassettes.get(cassetteOrId) : cassetteOrId;
    if (!cassette) {
      throw new Error(`Replay cassette '${cassetteOrId}' not found`);
    }

    const { request: recordedReq } = cassette;
    const headers = new Headers();
    for (const [k, v] of Object.entries(recordedReq.headers)) {
      if (v !== "[REDACTED]") {
        headers.set(k, v);
      }
    }

    const init: RequestInit = {
      method: recordedReq.method,
      headers
    };

    if (recordedReq.body && recordedReq.method !== "GET" && recordedReq.method !== "HEAD") {
      init.body = typeof recordedReq.body === "string" ? recordedReq.body : JSON.stringify(recordedReq.body);
      if (!headers.has("content-type")) {
        headers.set("content-type", "application/json");
      }
    }

    const req = new Request(recordedReq.url, init);
    const res = await targetScope.handle(req);

    let body: any;
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      body = await res.json();
    } else {
      body = await res.text();
    }

    return {
      status: res.status,
      body,
      headers: res.headers
    };
  }

  public export(id: string): string {
    const tape = this.getTape(id);
    if (!tape) throw new Error(`Replay tape '${id}' not found`);
    return JSON.stringify(tape, null, 2);
  }

  public import(jsonString: string): ReplayCassette {
    const tape: ReplayCassette = JSON.parse(jsonString);
    this.cassettes.set(tape.id, tape);
    return tape;
  }

  public clear(): void {
    this.cassettes.clear();
  }
}

export const replay = new ApexReplayEngine();
