import { ValidationError, ApexRequestContext } from "@apex14/http";
import { validateOrThrow } from "@apex14/validation";
import type { Middleware } from "./types.js";

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+(instructions|prompts|directions)/i,
  /system\s+prompt\s+override/i,
  /you\s+are\s+now\s+(in\s+developer\s+mode|unrestrained|dan\s+mode)/i,
  /jailbreak/i,
  /reveal\s+(your\s+)?system\s+prompt/i,
  /disregard\s+(all\s+)?safety\s+guidelines/i,
  /act\s+as\s+an\s+unfiltered\s+ai/i
];

export class ApexGuardrailEngine {
  public isSafePrompt(text: string): { safe: boolean; reason?: string } {
    if (!text || typeof text !== "string") {
      return { safe: true };
    }

    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(text)) {
        return {
          safe: false,
          reason: `Potential prompt injection / jailbreak detected matching rule: ${pattern.source}`
        };
      }
    }

    return { safe: true };
  }

  public assertSafePrompt(text: string): void {
    const check = this.isSafePrompt(text);
    if (!check.safe) {
      throw new ValidationError(check.reason || "Prompt failed security guardrail validation");
    }
  }

  public repairJson(rawText: string): any {
    if (!rawText || typeof rawText !== "string") {
      return rawText;
    }

    let cleaned = rawText.trim();

    // 1. Strip Markdown code blocks
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    }

    // 2. Remove trailing commas before closing braces/brackets
    cleaned = cleaned.replace(/,\s*([}\]])/g, "$1");

    // 3. Attempt direct parse
    try {
      return JSON.parse(cleaned);
    } catch {
      // 4. Fallback: extract first valid { ... } or [ ... ] block
      const startObj = cleaned.indexOf("{");
      const endObj = cleaned.lastIndexOf("}");
      if (startObj !== -1 && endObj > startObj) {
        const candidate = cleaned.slice(startObj, endObj + 1).replace(/,\s*([}\]])/g, "$1");
        try {
          return JSON.parse(candidate);
        } catch {
          // ignore
        }
      }

      const startArr = cleaned.indexOf("[");
      const endArr = cleaned.lastIndexOf("]");
      if (startArr !== -1 && endArr > startArr) {
        const candidate = cleaned.slice(startArr, endArr + 1).replace(/,\s*([}\]])/g, "$1");
        try {
          return JSON.parse(candidate);
        } catch {
          // ignore
        }
      }

      throw new ValidationError(`Failed to parse and repair JSON from AI output: ${cleaned.slice(0, 100)}...`);
    }
  }

  public repairAndValidate<T = any>(rawText: string, schema: any): T {
    const parsed = this.repairJson(rawText);
    if (schema) {
      return validateOrThrow(schema, parsed);
    }
    return parsed as T;
  }

  public protect(options: { scanInjection?: boolean; schema?: any } = { scanInjection: true }): Middleware {
    return async (ctx: ApexRequestContext, next: () => Promise<any>) => {
      if (options.scanInjection) {
        const promptCandidate =
          typeof ctx.body === "string"
            ? ctx.body
            : ctx.body?.prompt || ctx.body?.message || ctx.body?.query || ctx.body?.userInput;
        if (promptCandidate && typeof promptCandidate === "string") {
          this.assertSafePrompt(promptCandidate);
        }
      }

      const result = await next();

      if (options.schema && typeof result === "string") {
        return this.repairAndValidate(result, options.schema);
      }

      return result;
    };
  }
}

export const guardrail = new ApexGuardrailEngine();
