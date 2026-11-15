import { AuthenticationError } from "@apex14/http";

export interface JwtHeader {
  alg: "HS256" | "RS256" | "ES256";
  typ: "JWT";
  kid?: string;
  [key: string]: any;
}

export interface JwtPayload {
  sub?: string;
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
  jti?: string;
  [key: string]: any;
}

export interface JwtSignOptions {
  expiresIn?: string | number; // e.g. "15m", "1h", "7d", or seconds
  issuer?: string;
  audience?: string | string[];
  subject?: string;
  algorithm?: "HS256";
  kid?: string;
}

export interface JwtVerifyOptions {
  issuer?: string | string[];
  audience?: string | string[];
  algorithms?: string[];
  clockTolerance?: number; // seconds
}

function base64UrlEncode(data: Uint8Array | string): string {
  const buf = typeof data === "string" ? Buffer.from(data, "utf8") : Buffer.from(data);
  return buf.toString("base64url");
}

function base64UrlDecode(str: string): Buffer {
  return Buffer.from(str, "base64url");
}

export function parseDuration(duration: string | number): number {
  if (typeof duration === "number") return duration;
  const match = duration.match(/^(\d+)(s|m|h|d)$/);
  if (!match) throw new Error(`Invalid duration format: ${duration}`);
  const val = parseInt(match[1]!, 10);
  const unit = match[2];
  switch (unit) {
    case "s": return val;
    case "m": return val * 60;
    case "h": return val * 3600;
    case "d": return val * 86400;
    default: return val;
  }
}

export class Jwt {
  public static async sign(
    payload: JwtPayload,
    secret: string,
    options: JwtSignOptions = {}
  ): Promise<string> {
    const alg = options.algorithm || "HS256";
    if (alg !== "HS256") {
      throw new Error(`Unsupported algorithm: ${alg}`);
    }

    const header: JwtHeader = {
      alg,
      typ: "JWT",
      ...(options.kid ? { kid: options.kid } : {})
    };

    const now = Math.floor(Date.now() / 1000);
    const finalPayload: JwtPayload = {
      ...payload,
      iat: payload.iat ?? now
    };

    if (options.expiresIn !== undefined && finalPayload.exp === undefined) {
      finalPayload.exp = now + parseDuration(options.expiresIn);
    }
    if (options.issuer && finalPayload.iss === undefined) {
      finalPayload.iss = options.issuer;
    }
    if (options.audience && finalPayload.aud === undefined) {
      finalPayload.aud = options.audience;
    }
    if (options.subject && finalPayload.sub === undefined) {
      finalPayload.sub = options.subject;
    }

    const encHeader = base64UrlEncode(JSON.stringify(header));
    const encPayload = base64UrlEncode(JSON.stringify(finalPayload));
    const signingInput = `${encHeader}.${encPayload}`;

    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(signingInput));
    const encSig = base64UrlEncode(new Uint8Array(sigBuf));

    return `${signingInput}.${encSig}`;
  }

  public static async verify<T = JwtPayload>(
    token: string,
    secretOrKeys: string | string[],
    options: JwtVerifyOptions = {}
  ): Promise<T> {
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new AuthenticationError("Invalid JWT format");
    }

    const [encHeader, encPayload, encSig] = parts as [string, string, string];

    // Decode header
    let header: JwtHeader;
    try {
      header = JSON.parse(base64UrlDecode(encHeader).toString("utf8"));
    } catch {
      throw new AuthenticationError("Invalid JWT header");
    }

    // Algorithm check - explicitly reject 'none'
    if (!header.alg || header.alg.toLowerCase() === "none") {
      throw new AuthenticationError("Invalid JWT algorithm");
    }

    const allowedAlgorithms = options.algorithms || ["HS256"];
    if (!allowedAlgorithms.includes(header.alg)) {
      throw new AuthenticationError(`Disallowed JWT algorithm: ${header.alg}`);
    }

    // Verify signature with secret(s)
    const signingInput = `${encHeader}.${encPayload}`;
    const enc = new TextEncoder();
    const sigBytes = base64UrlDecode(encSig);

    const secrets = Array.isArray(secretOrKeys) ? secretOrKeys : [secretOrKeys];
    let signatureValid = false;

    for (const secret of secrets) {
      const key = await crypto.subtle.importKey(
        "raw",
        enc.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"]
      );

      const isValid = await crypto.subtle.verify("HMAC", key, sigBytes, enc.encode(signingInput));
      if (isValid) {
        signatureValid = true;
        break;
      }
    }

    if (!signatureValid) {
      throw new AuthenticationError("Invalid JWT signature");
    }

    // Decode and validate payload claims
    let payload: JwtPayload;
    try {
      payload = JSON.parse(base64UrlDecode(encPayload).toString("utf8"));
    } catch {
      throw new AuthenticationError("Invalid JWT payload");
    }

    const now = Math.floor(Date.now() / 1000);
    const tolerance = options.clockTolerance || 0;

    // Check exp (Expiration)
    if (payload.exp !== undefined && now > payload.exp + tolerance) {
      throw new AuthenticationError("JWT has expired");
    }

    // Check nbf (Not Before)
    if (payload.nbf !== undefined && now < payload.nbf - tolerance) {
      throw new AuthenticationError("JWT not active yet (nbf claim)");
    }

    // Check iss (Issuer)
    if (options.issuer) {
      const expectedIssuers = Array.isArray(options.issuer) ? options.issuer : [options.issuer];
      if (!payload.iss || !expectedIssuers.includes(payload.iss)) {
        throw new AuthenticationError(`Invalid JWT issuer: expected ${expectedIssuers.join(", ")}`);
      }
    }

    // Check aud (Audience)
    if (options.audience) {
      const expectedAud = Array.isArray(options.audience) ? options.audience : [options.audience];
      const audList = Array.isArray(payload.aud) ? payload.aud : payload.aud ? [payload.aud] : [];
      const hasMatch = audList.some((a) => expectedAud.includes(a));
      if (!hasMatch) {
        throw new AuthenticationError(`Invalid JWT audience: expected ${expectedAud.join(", ")}`);
      }
    }

    return payload as T;
  }

  public static decode<T = JwtPayload>(token: string): { header: JwtHeader; payload: T } | null {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return null;
      const header = JSON.parse(base64UrlDecode(parts[0]!).toString("utf8"));
      const payload = JSON.parse(base64UrlDecode(parts[1]!).toString("utf8"));
      return { header, payload };
    } catch {
      return null;
    }
  }
}
