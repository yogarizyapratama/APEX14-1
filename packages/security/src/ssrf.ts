import dns from "node:dns/promises";
import { ApexError } from "@apex14/http";

export function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return false;
  }

  const [a, b, c, d] = parts as [number, number, number, number];

  // 0.0.0.0/8
  if (a === 0) return true;
  // 10.0.0.0/8 (Private)
  if (a === 10) return true;
  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;
  // 169.254.0.0/16 (Link-Local & Cloud Metadata 169.254.169.254)
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12 (Private)
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16 (Private)
  if (a === 192 && b === 168) return true;
  // 255.255.255.255 (Broadcast)
  if (a === 255 && b === 255 && c === 255 && d === 255) return true;

  return false;
}

export function isPrivateIpv6(ip: string): boolean {
  const norm = ip.toLowerCase().trim();
  // Loopback ::1
  if (norm === "::1" || norm === "0:0:0:0:0:0:0:1") return true;
  // Unspecified ::
  if (norm === "::" || norm === "0:0:0:0:0:0:0:0") return true;
  // Unique local addresses (fc00::/7 -> fc.. or fd..)
  if (norm.startsWith("fc") || norm.startsWith("fd")) return true;
  // Link-local unicast (fe80::/10)
  if (norm.startsWith("fe8") || norm.startsWith("fe9") || norm.startsWith("fea") || norm.startsWith("feb")) return true;

  return false;
}

export function isPrivateIp(ip: string): boolean {
  if (ip.includes(":")) {
    return isPrivateIpv6(ip);
  }
  return isPrivateIpv4(ip);
}

export interface SafeUrlOptions {
  allowPrivate?: boolean;
  allowedProtocols?: string[];
}

export async function validateSafeUrl(
  input: string | URL,
  options: SafeUrlOptions = {}
): Promise<{ safe: boolean; reason?: string; resolvedIps?: string[] }> {
  let parsed: URL;
  try {
    parsed = typeof input === "string" ? new URL(input) : input;
  } catch {
    return { safe: false, reason: "Invalid URL string" };
  }

  const allowedProtocols = options.allowedProtocols || ["http:", "https:"];
  if (!allowedProtocols.includes(parsed.protocol)) {
    return { safe: false, reason: `Disallowed protocol: ${parsed.protocol}` };
  }

  const hostname = parsed.hostname;

  // Direct IP checks
  if (isPrivateIp(hostname)) {
    if (!options.allowPrivate) {
      return { safe: false, reason: `Target IP ${hostname} is a restricted private/local address` };
    }
  }

  // Hostname DNS resolution check
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    const ips = addresses.map((a) => a.address);

    if (!options.allowPrivate) {
      for (const ip of ips) {
        if (isPrivateIp(ip)) {
          return {
            safe: false,
            reason: `Host ${hostname} resolves to restricted private IP ${ip}`,
            resolvedIps: ips
          };
        }
      }
    }

    return { safe: true, resolvedIps: ips };
  } catch (err: any) {
    return { safe: false, reason: `DNS lookup failed for ${hostname}: ${err.message}` };
  }
}

export async function assertSafeUrl(input: string | URL, options?: SafeUrlOptions): Promise<void> {
  const result = await validateSafeUrl(input, options);
  if (!result.safe) {
    throw new ApexError(400, `SSRF Protection: ${result.reason}`, "SSRF_RISK", {
      url: String(input),
      reason: result.reason
    });
  }
}
