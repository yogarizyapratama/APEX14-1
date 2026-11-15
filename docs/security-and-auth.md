# APEX14 — Enterprise Security & Authentication Engine

Security is a foundational capability in APEX14. Cryptographic primitives leverage native **WebCrypto** and **node:crypto** to ensure optimal performance, zero external cryptographic vulnerabilities, and timing-attack immunity.

---

## 1. JSON Web Tokens (JWT)

Built-in WebCrypto JWT module supporting HS256, expiration enforcement, claim validation, and key rotation.

```ts
import { Jwt, route, guard } from "apex14";

const JWT_SECRET = process.env.JWT_SECRET || "super-secure-key-32-chars-long";

// 1. Sign JWT
route("/auth/token", () => {
  return Jwt.sign(
    { sub: "usr_100", role: "admin" },
    JWT_SECRET,
    {
      expiresIn: "2h",          // e.g. "15m", "1h", "7d", or seconds
      issuer: "apex14-app",
      audience: "api-clients"
    }
  );
});

// 2. Protect routes with a Guard
guard("auth", async (ctx) => {
  const header = ctx.headers["authorization"];
  if (!header || !header.startsWith("Bearer ")) {
    return false; // Denies request with 403 / 401
  }

  const token = header.slice(7);
  // Validates signature, exp, nbf, iss, aud
  const payload = await Jwt.verify(token, JWT_SECRET, {
    issuer: "apex14-app",
    audience: "api-clients"
  });

  ctx.user = payload;
  return true;
});

route("/dashboard", ({ user }) => ({
  message: "Welcome",
  user
}), { guard: "auth" });
```

---

## 2. Password Hashing (Timing-Safe Scrypt)

Never store plaintext passwords. APEX14 provides secure Scrypt password hashing with cryptographically random salts and constant-time equality checks (`crypto.timingSafeEqual`):

```ts
import { hashPassword, verifyPassword } from "apex14";

// 1. Hash password with random salt
const hashedPassword = await hashPassword("mySecretPassword123");
// Produces: $apex$scrypt$N=16384,r=8,p=1$<saltHex>$<derivedKeyHex>

// 2. Verify password
const isMatch = await verifyPassword("mySecretPassword123", hashedPassword);
console.log(isMatch); // true

const isWrong = await verifyPassword("wrongPassword", hashedPassword);
console.log(isWrong); // false
```

---

## 3. Sliding-Window Rate Limiting

Protect your API endpoints against brute force, denial of service, and scraping attacks:

```ts
import { use, rateLimit } from "apex14";

// Global rate limiter: Max 100 requests per minute per IP
use(rateLimit({
  max: 100,
  windowMs: 60 * 1000,
  // Custom key generator (optional, defaults to client IP)
  keyGenerator: (ctx) => ctx.headers["x-api-key"] || ctx.ip
}));
```

Automatically adds standard response headers:
- `RateLimit-Limit`: Maximum requests permitted in window.
- `RateLimit-Remaining`: Requests remaining in current window.
- `RateLimit-Reset`: Seconds remaining until quota reset.

When exceeded, throws HTTP 429 `RateLimitError`.

---

## 4. Security Headers & CORS

```ts
import { use, securityHeaders, cors } from "apex14";

// Security headers (HSTS, CSP, X-Frame-Options, X-Content-Type-Options)
use(securityHeaders({
  frameOptions: "DENY",
  contentTypeOptions: true,
  contentSecurityPolicy: "default-src 'self'",
  hsts: { maxAge: 31536000, includeSubDomains: true }
}));

// CORS middleware
use(cors({
  origin: ["https://myapp.com", "https://admin.myapp.com"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
}));
```

---

## 5. SSRF Defense (Server-Side Request Forgery)

When your application fetches user-supplied URLs (e.g., webhooks, avatar import, URL previews), APEX14 inspects the destination hostname and resolves DNS to prevent access to private IP spaces and cloud metadata endpoints:

```ts
import { assertSafeUrl, validateSafeUrl } from "apex14";

route("/webhook/trigger", async ({ body }) => {
  // Throws ApexError (400, "SSRF_RISK") if target points to:
  // - 127.0.0.0/8 (Loopback / localhost)
  // - 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16 (Private LAN)
  // - 169.254.169.254 (AWS / GCP / Azure metadata endpoint!)
  // - ::1 (IPv6 Loopback), fc00::/7 (IPv6 Unique Local)
  await assertSafeUrl(body.callbackUrl);

  const res = await fetch(body.callbackUrl, { method: "POST" });
  return { status: "dispatched" };
});
```
