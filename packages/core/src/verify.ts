import crypto from "node:crypto";
import { AuthenticationError, ApexRequestContext } from "@apex14/http";
import type { Middleware } from "./types.js";

export interface VerifySignedOptions {
  algorithm?: "HMAC-SHA256" | "Ed25519";
  secretOrKey: string;
  signatureHeader?: string;
  timestampHeader?: string;
  maxDriftSeconds?: number;
}

export function computeBodyDigest(body: any): string {
  if (!body) return "";
  const str = typeof body === "string" ? body : JSON.stringify(body);
  return crypto.createHash("sha256").update(str).digest("hex");
}

export function buildCanonicalSigningString(method: string, path: string, timestamp: string | number, bodyDigest: string): string {
  return `${method.toUpperCase()}\n${path}\n${timestamp}\n${bodyDigest}`;
}

export class ApexVerifyEngine {
  public signedRequest(options: VerifySignedOptions): Middleware {
    const sigHeader = (options.signatureHeader || "x-signature").toLowerCase();
    const timeHeader = (options.timestampHeader || "x-timestamp").toLowerCase();
    const maxDrift = options.maxDriftSeconds || 60;

    return async (ctx: ApexRequestContext, next: () => Promise<any>) => {
      const signature = ctx.headers[sigHeader];
      const timestampStr = ctx.headers[timeHeader];

      if (!signature) {
        throw new AuthenticationError(`Missing required signature header '${options.signatureHeader || "x-signature"}'`);
      }

      if (!timestampStr) {
        throw new AuthenticationError(`Missing required timestamp header '${options.timestampHeader || "x-timestamp"}'`);
      }

      const timestamp = parseInt(timestampStr, 10);
      const now = Math.floor(Date.now() / 1000);
      if (isNaN(timestamp) || Math.abs(now - timestamp) > maxDrift) {
        throw new AuthenticationError("Request timestamp drift exceeds allowed tolerance");
      }

      const bodyDigest = computeBodyDigest(ctx.body);
      const canonical = buildCanonicalSigningString(ctx.request.method, ctx.url.pathname, timestamp, bodyDigest);

      const expectedSig = crypto
        .createHmac("sha256", options.secretOrKey)
        .update(canonical)
        .digest("hex");

      const sigBuf = Buffer.from(signature, "hex");
      const expectedBuf = Buffer.from(expectedSig, "hex");

      if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
        throw new AuthenticationError("Invalid cryptographic request signature");
      }

      return await next();
    };
  }

  public sign(
    requestData: { method: string; pathname: string; timestamp: number; body?: any },
    secret: string
  ): string {
    const bodyDigest = computeBodyDigest(requestData.body);
    const canonical = buildCanonicalSigningString(
      requestData.method,
      requestData.pathname,
      requestData.timestamp,
      bodyDigest
    );
    return crypto.createHmac("sha256", secret).update(canonical).digest("hex");
  }
}

export const verify = new ApexVerifyEngine();
