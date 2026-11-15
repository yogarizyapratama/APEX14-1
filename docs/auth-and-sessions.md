# Direct Auth & Session Engine (`auth`)

APEX14 provides a zero-boilerplate, direct-function authentication and session management engine. Instead of configuring multiple third-party libraries and manually writing session DDL schemas, `auth` provides instant session creation, JWT/cookie rotation, and role-based guards.

---

## 1. Quick Setup

```ts
import { auth, route, guard } from "apex14";

// Configure once; automatically sets up middleware, session stores, and guards
auth.configure({
  secret: process.env.JWT_SECRET || "super-secure-production-secret-key-32b",
  session: {
    strategy: "jwt",
    cookieName: "apex14_session",
    ttlSeconds: 60 * 60 * 24 * 7 // 7 days
  },
  mountRoutes: true // Auto-mounts /auth/register, /auth/login, /auth/me, /auth/logout
});
```

---

## 2. Auto-Mounted Endpoints

When `mountRoutes: true` (default), APEX14 automatically exposes:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/auth/register` | Registers new user and issues session token |
| `POST` | `/auth/login` | Validates credentials and sets HTTP-only cookie or returns JWT |
| `GET` | `/auth/me` | Returns current authenticated user and session metadata |
| `POST` | `/auth/logout` | Terminates session and clears cookie |

---

## 3. Protecting Routes with Guards

APEX14 auto-registers the `"auth"` and `"admin"` guards:

```ts
import { route, guard } from "apex14";

// Requires valid Bearer token or session cookie
route("/dashboard", {
  GET: ({ user }) => ({ welcome: user.email })
}, {
  guard: "auth"
});

// Requires user to have the "admin" role
route("/admin/settings", {
  GET: () => ({ system: "healthy" })
}, {
  guard: "admin"
});

// Custom role check
route("/org/billing", {
  GET: ({ user }) => ({ billingAccount: user.id })
}, {
  guard: auth.guard(["finance", "owner"])
});
```

---

## 4. Programmatic Session Control

```ts
import { auth, route } from "apex14";

route("/custom-login", {
  POST: async (ctx) => {
    const user = { id: "usr_99", email: "ceo@company.com", roles: ["admin"] };
    const { token, session } = await auth.createSession(user);

    ctx.cookie("apex14_session", token, { httpOnly: true, secure: true });
    return { token, expiresAt: session.expiresAt };
  }
});
```
