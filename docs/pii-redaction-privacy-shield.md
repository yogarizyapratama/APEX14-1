# Automated PII Redaction & Privacy Shield (`mask`)

Prevent catastrophic compliance leaks of Personally Identifiable Information (PII) such as credit cards, Social Security Numbers, emails, and phone numbers in HTTP responses and logs.

---

## 1. Automatic In-Memory Object Sanitization

`mask.sanitize()` scans and redacts sensitive data recursively:

```ts
import { mask } from "apex14";

const safeUser = mask.sanitize(userData, {
  pii: true // Enables credit card (Luhn validated), email, phone, and SSN masking
});
```

### Transformation Examples
- **Credit Card Number:** `4532015112830366` $\rightarrow$ `****-****-****-0366`
- **Email Address:** `alex.rivera@example.com` $\rightarrow$ `a***@example.com`
- **Phone Number:** `+1-555-123-4567` $\rightarrow$ `+1-****67`
- **SSN:** `123-45-6789` $\rightarrow$ `***-**-6789`
- **Sensitive Keys (`password`, `apiKey`, `token`):** $\rightarrow$ `[REDACTED]`

---

## 2. Automatic Route Response Sanitization

Attach `mask.middleware()` to automatically sanitize outgoing JSON payloads:

```ts
import { mask, route } from "apex14";

route("/api/users/:id", getUserHandler, {
  middleware: [mask.middleware({ pii: true })]
});
```
