# Cryptographic Request Attestation (`verify`)

Protect server-to-server APIs, partner endpoints, and financial webhooks against spoofing, payload tampering, and replay attacks with constant-time HMAC-SHA256 signature verification.

---

## 1. Protecting Routes with `verify.signedRequest()`

```ts
import { verify, route } from "apex14";

route("/api/partner/settlement", async (ctx) => {
  return { status: "settled", amount: ctx.body.amount };
}, {
  method: "POST",
  middleware: [
    verify.signedRequest({
      secretOrKey: process.env.PARTNER_SHARED_SECRET!,
      signatureHeader: "x-signature",
      timestampHeader: "x-timestamp",
      maxDriftSeconds: 60 // Anti-replay window
    })
  ]
});
```

---

## 2. Generating Signatures on the Client / Partner Side

APEX14 provides `verify.sign()` to produce canonical signatures:

```ts
import { verify } from "apex14";

const timestamp = Math.floor(Date.now() / 1000);
const payload = { orderId: "ord_123", amount: 1500 };

const signature = verify.sign(
  {
    method: "POST",
    pathname: "/api/partner/settlement",
    timestamp,
    body: payload
  },
  SECRET
);

// Include in request headers
await fetch("https://api.example.com/api/partner/settlement", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-signature": signature,
    "x-timestamp": String(timestamp)
  },
  body: JSON.stringify(payload)
});
```

---

## 3. Security Properties

1. **Canonical Payload Hashing:** SHA-256 of the raw body payload is included in the signature preimage. Any mutation of even a single byte invalidates the signature.
2. **Replay Attack Defense:** Any request timestamp older or newer than `maxDriftSeconds` is rejected with HTTP 401.
3. **Timing-Safe Equality:** Checked with `crypto.timingSafeEqual()` to prevent side-channel timing attacks.
