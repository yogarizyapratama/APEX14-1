import { AuthenticationError } from "@apex14/http";
import type { ApexRequestContext } from "@apex14/http";

export type WebhookProvider = "stripe" | "github" | "generic";

export interface WebhookConfig {
  provider?: WebhookProvider;
  secret: string;
  idempotent?: boolean;
  toleranceSeconds?: number;
  handler: (event: any, ctx: ApexRequestContext) => Promise<any> | any;
}

const processedEventIds = new Set<string>();

export async function computeHmacSha256Hex(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function createWebhookHandler(config: WebhookConfig): (ctx: ApexRequestContext) => Promise<any> {
  const provider = config.provider || "generic";
  const tolerance = config.toleranceSeconds ?? 300; // 5 minutes default

  return async (ctx: ApexRequestContext) => {
    // 1. Retrieve raw body text
    const rawBody = typeof ctx.body === "string" ? ctx.body : JSON.stringify(ctx.body || {});
    const headers = ctx.headers;

    // 2. Cryptographic signature verification
    if (provider === "stripe") {
      const sigHeader = headers["stripe-signature"];
      if (!sigHeader) {
        throw new AuthenticationError("Missing stripe-signature header");
      }

      const parts = sigHeader.split(",").reduce((acc: Record<string, string>, item) => {
        const [k, v] = item.trim().split("=");
        if (k && v) acc[k] = v;
        return acc;
      }, {});

      const timestamp = parts["t"];
      const signature = parts["v1"];

      if (!timestamp || !signature) {
        throw new AuthenticationError("Invalid stripe-signature format");
      }

      // Check timestamp tolerance
      const eventTime = parseInt(timestamp, 10);
      if (Math.abs(Date.now() / 1000 - eventTime) > tolerance) {
        throw new AuthenticationError("Webhook signature timestamp expired");
      }

      const expected = await computeHmacSha256Hex(config.secret, `${timestamp}.${rawBody}`);
      if (expected !== signature) {
        throw new AuthenticationError("Stripe webhook signature mismatch");
      }
    } else if (provider === "github") {
      const sigHeader = headers["x-hub-signature-256"];
      if (!sigHeader || !sigHeader.startsWith("sha256=")) {
        throw new AuthenticationError("Missing or invalid x-hub-signature-256 header");
      }
      const signature = sigHeader.slice(7);
      const expected = await computeHmacSha256Hex(config.secret, rawBody);
      if (expected !== signature) {
        throw new AuthenticationError("GitHub webhook signature mismatch");
      }
    } else {
      const sigHeader = headers["x-signature"];
      if (sigHeader) {
        const expected = await computeHmacSha256Hex(config.secret, rawBody);
        if (expected !== sigHeader) {
          throw new AuthenticationError("Webhook signature mismatch");
        }
      }
    }

    // 3. Parse JSON event
    let event: any = ctx.body;
    if (typeof event === "string") {
      try {
        event = JSON.parse(event);
      } catch {
        event = { raw: event };
      }
    }

    // 4. Idempotency Check
    if (config.idempotent) {
      const eventId =
        event?.id ||
        headers["x-github-delivery"] ||
        headers["idempotency-key"];

      if (eventId) {
        if (processedEventIds.has(eventId)) {
          return { received: true, idempotent: true, skipped: true };
        }
        processedEventIds.add(eventId);
        // Keep set size reasonable
        if (processedEventIds.size > 10000) {
          const first = processedEventIds.values().next().value;
          if (first) processedEventIds.delete(first);
        }
      }
    }

    // 5. Execute user handler
    const result = await config.handler(event, ctx);
    return result !== undefined ? result : { received: true };
  };
}
