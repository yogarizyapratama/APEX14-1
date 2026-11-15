export interface CookieOptions {
  domain?: string;
  expires?: Date;
  httpOnly?: boolean;
  maxAge?: number;
  path?: string;
  sameSite?: "Strict" | "Lax" | "None" | "strict" | "lax" | "none" | boolean;
  secure?: boolean;
  signed?: boolean;
}

export function parseCookies(cookieHeader?: string | null): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;

  const pairs = cookieHeader.split(";");
  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i]!.trim();
    if (!pair) continue;
    const eqIdx = pair.indexOf("=");
    if (eqIdx === -1) {
      list[pair] = "";
    } else {
      const key = pair.slice(0, eqIdx).trim();
      let val = pair.slice(eqIdx + 1).trim();
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1);
      }
      try {
        list[key] = decodeURIComponent(val);
      } catch {
        list[key] = val;
      }
    }
  }
  return list;
}

export function serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
  let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;

  if (options.maxAge !== undefined) {
    cookie += `; Max-Age=${Math.floor(options.maxAge)}`;
  }
  if (options.domain) {
    cookie += `; Domain=${options.domain}`;
  }
  if (options.path) {
    cookie += `; Path=${options.path}`;
  } else {
    cookie += `; Path=/`;
  }
  if (options.expires) {
    cookie += `; Expires=${options.expires.toUTCString()}`;
  }
  if (options.httpOnly) {
    cookie += `; HttpOnly`;
  }
  if (options.secure) {
    cookie += `; Secure`;
  }
  if (options.sameSite) {
    const s = typeof options.sameSite === "string" ? options.sameSite.toLowerCase() : "lax";
    if (s === "strict") cookie += `; SameSite=Strict`;
    else if (s === "none") cookie += `; SameSite=None`;
    else cookie += `; SameSite=Lax`;
  }

  return cookie;
}

export async function signCookie(value: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(value));
  const b64 = Buffer.from(signature).toString("base64url");
  return `s:${value}.${b64}`;
}

export async function unsignCookie(input: string, secret: string): Promise<string | false> {
  if (!input.startsWith("s:")) return false;
  const content = input.slice(2);
  const lastDot = content.lastIndexOf(".");
  if (lastDot === -1) return false;

  const value = content.slice(0, lastDot);
  const signature = content.slice(lastDot + 1);

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const sigBuf = Buffer.from(signature, "base64url");
  const valid = await crypto.subtle.verify("HMAC", key, sigBuf, enc.encode(value));
  return valid ? value : false;
}
