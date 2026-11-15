import { ApexRequestContext } from "@apex14/http";
import type { ApexScope } from "./scope.js";
import { getActiveScope } from "./scope.js";

export interface Incident {
  id: string;
  timestamp: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  params: Record<string, string>;
  body: any;
  error: {
    name: string;
    message: string;
    stack?: string;
  };
  aiRemediationPrompt: string;
  replayedAt?: string;
  replayStatus?: number;
}

export interface HealConfig {
  enabled?: boolean;
  replayCapture?: boolean;
  anonymize?: string[];
  maxIncidents?: number;
  onIncident?: (incident: Incident) => void;
}

export class ApexHealEngine {
  public enabled = true;
  private replayCapture = true;
  private anonymizeKeys = new Set(["authorization", "password", "token", "secret", "cookie", "api_key", "credit_card"]);
  private maxIncidents = 50;
  private incidents: Incident[] = [];
  private onIncidentCallback?: (incident: Incident) => void;

  public configure(config: HealConfig): void {
    if (config.enabled !== undefined) this.enabled = config.enabled;
    if (config.replayCapture !== undefined) this.replayCapture = config.replayCapture;
    if (config.maxIncidents) this.maxIncidents = config.maxIncidents;
    if (config.onIncident) this.onIncidentCallback = config.onIncident;
    if (config.anonymize) {
      for (const k of config.anonymize) {
        this.anonymizeKeys.add(k.toLowerCase());
      }
    }
  }

  public capture(error: any, ctx: ApexRequestContext): Incident | null {
    if (!this.enabled || !this.replayCapture) return null;

    const id = `inc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const url = ctx.request.url;
    const method = ctx.request.method;

    // Anonymize headers
    const headers: Record<string, string> = {};
    if (ctx.headers) {
      for (const [key, val] of Object.entries(ctx.headers)) {
        if (this.anonymizeKeys.has(key.toLowerCase())) {
          headers[key] = "[REDACTED]";
        } else {
          headers[key] = val;
        }
      }
    }

    // Anonymize body
    const body = this.sanitizeData(ctx.body);

    const errObj = {
      name: error?.name || "Error",
      message: error?.message || String(error),
      stack: error?.stack
    };

    const aiRemediationPrompt = this.generateAiRemediationPrompt(method, url, body, errObj);

    const incident: Incident = {
      id,
      timestamp: new Date().toISOString(),
      method,
      url,
      headers,
      params: ctx.params || {},
      body,
      error: errObj,
      aiRemediationPrompt
    };

    this.incidents.unshift(incident);
    if (this.incidents.length > this.maxIncidents) {
      this.incidents.pop();
    }

    if (this.onIncidentCallback) {
      try {
        this.onIncidentCallback(incident);
      } catch {
        // Safe ignore
      }
    }

    return incident;
  }

  public listIncidents(): Incident[] {
    return [...this.incidents];
  }

  public getIncident(id: string): Incident | undefined {
    return this.incidents.find((i) => i.id === id);
  }

  public async replay(id: string, scope: ApexScope = getActiveScope()): Promise<{ status: number; result: any }> {
    const incident = this.getIncident(id);
    if (!incident) {
      throw new Error(`Incident '${id}' not found`);
    }

    const init: RequestInit = {
      method: incident.method,
      headers: incident.headers
    };

    if (incident.body && incident.method !== "GET" && incident.method !== "HEAD") {
      init.body = JSON.stringify(incident.body);
      (init.headers as any)["content-type"] = "application/json";
    }

    const req = new Request(incident.url, init);
    const res = await scope.handle(req);

    incident.replayedAt = new Date().toISOString();
    incident.replayStatus = res.status;

    let resBody: any;
    try {
      resBody = await res.json();
    } catch {
      resBody = await res.text();
    }

    return { status: res.status, result: resBody };
  }

  public clear(): void {
    this.incidents = [];
  }

  private sanitizeData(data: any): any {
    if (!data || typeof data !== "object") return data;
    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeData(item));
    }
    const clean: Record<string, any> = {};
    for (const [key, val] of Object.entries(data)) {
      if (this.anonymizeKeys.has(key.toLowerCase())) {
        clean[key] = "[REDACTED]";
      } else if (typeof val === "object") {
        clean[key] = this.sanitizeData(val);
      } else {
        clean[key] = val;
      }
    }
    return clean;
  }

  private generateAiRemediationPrompt(
    method: string,
    url: string,
    body: any,
    error: { name: string; message: string; stack?: string }
  ): string {
    return `### APEX14 Incident Diagnosis
Endpoint: ${method} ${url}
Exception: ${error.name} - ${error.message}
Payload:
\`\`\`json
${JSON.stringify(body, null, 2)}
\`\`\`
Stack Trace:
\`\`\`text
${error.stack || "No stack trace available"}
\`\`\`

Root Cause Analysis Task:
1. Identify the failing code path and why this input caused ${error.name}.
2. Check if null/undefined checks, missing schema fields, or unhandled promise rejections occurred.
3. Provide the minimal targeted code fix using APEX14 idiomatic patterns.`;
  }
}

export const heal = new ApexHealEngine();
