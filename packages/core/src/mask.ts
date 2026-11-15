import { ApexRequestContext } from "@apex14/http";
import type { Middleware } from "./types.js";

export interface MaskOptions {
  maskEmail?: boolean;
  maskPhone?: boolean;
  maskCreditCard?: boolean;
  maskSsn?: boolean;
  redactKeys?: string[];
  pii?: boolean; // Enable all PII masking
}

function luhnCheck(numStr: string): boolean {
  const digits = numStr.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits.charAt(i), 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

const EMAIL_REGEX = /\b([a-zA-Z0-9_.+-])[a-zA-Z0-9_.+-]*@([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)\b/g;
const PHONE_REGEX = /(\+?[0-9]{1,3}[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g;
const SSN_REGEX = /\b\d{3}-\d{2}-(\d{4})\b/g;
const CREDIT_CARD_REGEX = /\b(?:\d[ -]*?){13,19}\b/g;
const DEFAULT_SENSITIVE_KEYS = /password|secret|token|api_?key|auth|ssn|cvv|credit_?card/i;

export class ApexMaskEngine {
  public sanitize<T = any>(data: T, options: MaskOptions = {}): T {
    if (data === null || data === undefined) return data;

    const doAll = options.pii ?? false;
    const maskEmail = options.maskEmail ?? doAll;
    const maskPhone = options.maskPhone ?? doAll;
    const maskCreditCard = options.maskCreditCard ?? doAll;
    const maskSsn = options.maskSsn ?? doAll;
    const redactKeySet = new Set((options.redactKeys || []).map((k) => k.toLowerCase()));

    const sanitizeString = (str: string): string => {
      let result = str;

      if (maskCreditCard) {
        result = result.replace(CREDIT_CARD_REGEX, (match) => {
          const raw = match.replace(/\D/g, "");
          if (luhnCheck(raw)) {
            const last4 = raw.slice(-4);
            return `****-****-****-${last4}`;
          }
          return match;
        });
      }

      if (maskEmail) {
        result = result.replace(EMAIL_REGEX, (_match, firstChar, domain) => {
          return `${firstChar}***@${domain}`;
        });
      }

      if (maskSsn) {
        result = result.replace(SSN_REGEX, (_match, last4) => {
          return `***-**-${last4}`;
        });
      }

      if (maskPhone) {
        result = result.replace(PHONE_REGEX, (match) => {
          if (match.length >= 7) {
            const prefix = match.slice(0, 3);
            const suffix = match.slice(-2);
            return `${prefix}****${suffix}`;
          }
          return match;
        });
      }

      return result;
    };

    const traverse = (val: any, keyHint = ""): any => {
      if (typeof val === "string") {
        if (keyHint && (redactKeySet.has(keyHint.toLowerCase()) || DEFAULT_SENSITIVE_KEYS.test(keyHint))) {
          return "[REDACTED]";
        }
        return sanitizeString(val);
      }

      if (Array.isArray(val)) {
        return val.map((item) => traverse(item));
      }

      if (typeof val === "object" && val !== null) {
        const cleaned: Record<string, any> = {};
        for (const [k, v] of Object.entries(val)) {
          if (redactKeySet.has(k.toLowerCase()) || DEFAULT_SENSITIVE_KEYS.test(k)) {
            cleaned[k] = "[REDACTED]";
          } else {
            cleaned[k] = traverse(v, k);
          }
        }
        return cleaned;
      }

      return val;
    };

    return traverse(data);
  }

  public middleware(options: MaskOptions = { pii: true }): Middleware {
    return async (_ctx: ApexRequestContext, next: () => Promise<any>) => {
      const result = await next();
      return this.sanitize(result, options);
    };
  }

  public redact(keys: string[]): Middleware {
    return this.middleware({ redactKeys: keys });
  }
}

export const mask = new ApexMaskEngine();
