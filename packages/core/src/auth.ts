import { ApexRequestContext, AuthorizationError, ValidationError } from "@apex14/http";
import { Jwt, hashPassword, verifyPassword } from "@apex14/security";
import type { ApexScope } from "./scope.js";
import { getActiveScope } from "./scope.js";
import type { Middleware } from "./types.js";

export interface AuthUser {
  id: string;
  email: string;
  roles?: string[];
  permissions?: string[];
  [key: string]: any;
}

export interface AuthSession {
  id: string;
  userId: string;
  user: AuthUser;
  expiresAt: number;
  createdAt: number;
}

export interface AuthConfig {
  secret?: string;
  session?: {
    strategy?: "cookie" | "jwt" | "memory";
    cookieName?: string;
    ttlSeconds?: number;
  };
  providers?: string[];
  mountRoutes?: boolean;
  onLogin?: (credentials: { email: string; password?: string }) => Promise<AuthUser | null>;
  onRegister?: (data: { email: string; password?: string; name?: string }) => Promise<AuthUser>;
}

export class ApexAuthEngine {
  private config: Required<AuthConfig>;
  private memorySessions = new Map<string, AuthSession>();
  private memoryUsers = new Map<string, { user: AuthUser; passwordHash?: string }>();

  constructor() {
    this.config = {
      secret: "apex14-default-dev-secret-do-not-use-in-production-without-overriding",
      session: {
        strategy: "jwt",
        cookieName: "apex14_session",
        ttlSeconds: 60 * 60 * 24 * 7 // 7 days
      },
      providers: ["credentials"],
      mountRoutes: true,
      onLogin: async ({ email, password }) => {
        const record = this.memoryUsers.get(email.toLowerCase());
        if (!record) return null;
        if (record.passwordHash && password) {
          const valid = await verifyPassword(password, record.passwordHash);
          if (!valid) return null;
        }
        return record.user;
      },
      onRegister: async ({ email, password, name }) => {
        const existing = this.memoryUsers.get(email.toLowerCase());
        if (existing) {
          throw new ValidationError(`User with email '${email}' already exists`);
        }
        let passwordHash: string | undefined;
        if (password) {
          passwordHash = await hashPassword(password);
        }
        const user: AuthUser = {
          id: `usr_${Math.random().toString(36).substring(2, 10)}`,
          email: email.toLowerCase(),
          roles: ["user"],
          name
        };
        this.memoryUsers.set(email.toLowerCase(), { user, passwordHash });
        return user;
      }
    };
  }

  public configure(config: AuthConfig, scope: ApexScope = getActiveScope()): void {
    if (config.secret) this.config.secret = config.secret;
    if (config.session) this.config.session = { ...this.config.session, ...config.session };
    if (config.providers) this.config.providers = config.providers;
    if (config.mountRoutes !== undefined) this.config.mountRoutes = config.mountRoutes;
    if (config.onLogin) this.config.onLogin = config.onLogin;
    if (config.onRegister) this.config.onRegister = config.onRegister;

    // Register auto auth middleware
    scope.use(this.middleware());

    // Register auth guards
    scope.guard("auth", this.guard());
    scope.guard("admin", this.guard("admin"));

    if (this.config.mountRoutes) {
      this.mountAuthRoutes(scope);
    }
  }

  public async createSession(user: AuthUser): Promise<{ sessionId: string; token: string; session: AuthSession }> {
    const sessionId = `sess_${Math.random().toString(36).substring(2, 12)}`;
    const now = Date.now();
    const ttlMs = (this.config.session.ttlSeconds || 604800) * 1000;
    const expiresAt = now + ttlMs;

    const session: AuthSession = {
      id: sessionId,
      userId: user.id,
      user,
      expiresAt,
      createdAt: now
    };

    this.memorySessions.set(sessionId, session);

    // Create JWT
    const token = await Jwt.sign(
      {
        sub: user.id,
        sessionId,
        email: user.email,
        roles: user.roles || []
      },
      this.config.secret,
      { expiresIn: `${this.config.session.ttlSeconds || 604800}s` }
    );

    return { sessionId, token, session };
  }

  public async getSession(tokenOrSessionId: string): Promise<AuthSession | null> {
    if (!tokenOrSessionId) return null;

    // Check memory session by ID directly
    const directSession = this.memorySessions.get(tokenOrSessionId);
    if (directSession) {
      if (Date.now() > directSession.expiresAt) {
        this.memorySessions.delete(tokenOrSessionId);
        return null;
      }
      return directSession;
    }

    // Try decoding JWT
    try {
      const payload = await Jwt.verify<{ sub: string; sessionId?: string; email: string; roles: string[] }>(
        tokenOrSessionId,
        this.config.secret
      );

      if (payload.sessionId) {
        const memSession = this.memorySessions.get(payload.sessionId);
        if (memSession && Date.now() <= memSession.expiresAt) {
          return memSession;
        }
      }

      // Reconstruct session from valid JWT claims
      return {
        id: payload.sessionId || `jwt_${payload.sub}`,
        userId: payload.sub,
        user: {
          id: payload.sub,
          email: payload.email,
          roles: payload.roles || []
        },
        expiresAt: Date.now() + 3600000,
        createdAt: Date.now()
      };
    } catch {
      return null;
    }
  }

  public async destroySession(tokenOrSessionId: string): Promise<void> {
    this.memorySessions.delete(tokenOrSessionId);
    try {
      const payload = await Jwt.verify<{ sessionId?: string }>(tokenOrSessionId, this.config.secret);
      if (payload.sessionId) {
        this.memorySessions.delete(payload.sessionId);
      }
    } catch {
      // Ignored if not a valid JWT
    }
  }

  public middleware(): Middleware {
    return async (ctx, next) => {
      let token: string | undefined;

      const authHeader = ctx.headers["authorization"];
      if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
        token = authHeader.substring(7).trim();
      }

      if (!token && this.config.session.cookieName) {
        token = ctx.cookies[this.config.session.cookieName];
      }

      if (token) {
        const session = await this.getSession(token);
        if (session) {
          (ctx as any).session = session;
          (ctx as any).user = session.user;
        }
      }

      return await next();
    };
  }

  public guard(requiredRoles?: string | string[]): (ctx: ApexRequestContext) => Promise<boolean> {
    const roles = requiredRoles
      ? Array.isArray(requiredRoles)
        ? requiredRoles
        : [requiredRoles]
      : [];

    return async (ctx: ApexRequestContext) => {
      let user = (ctx as any).user as AuthUser | undefined;
      if (!user) {
        let token: string | undefined;
        const authHeader = ctx.headers["authorization"];
        if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
          token = authHeader.substring(7).trim();
        }
        if (!token && this.config.session.cookieName) {
          token = ctx.cookies[this.config.session.cookieName];
        }
        if (token) {
          const session = await this.getSession(token);
          if (session) {
            (ctx as any).session = session;
            (ctx as any).user = session.user;
            user = session.user;
          }
        }
      }

      if (!user) {
        return false;
      }

      if (roles.length > 0) {
        const userRoles = user.roles || [];
        const hasRole = roles.some((r) => userRoles.includes(r));
        if (!hasRole) return false;
      }

      return true;
    };
  }

  private mountAuthRoutes(scope: ApexScope): void {
    // 1. POST /auth/register
    scope.route("/auth/register", {
      POST: async ({ body }: ApexRequestContext) => {
        if (!body || !body.email) {
          throw new ValidationError("Email is required for registration");
        }
        const user = await this.config.onRegister(body);
        const { token, session } = await this.createSession(user);
        return {
          status: "success",
          user,
          token,
          session: { id: session.id, expiresAt: session.expiresAt }
        };
      }
    }, { summary: "Register a new user", tags: ["Authentication"] });

    // 2. POST /auth/login
    scope.route("/auth/login", {
      POST: async (ctx: ApexRequestContext) => {
        const body = ctx.body;
        if (!body || !body.email) {
          throw new ValidationError("Email is required for login");
        }
        const user = await this.config.onLogin(body);
        if (!user) {
          throw new AuthorizationError("Invalid credentials");
        }
        const { token, session } = await this.createSession(user);

        if (this.config.session.cookieName) {
          ctx.cookie(this.config.session.cookieName, token, {
            httpOnly: true,
            secure: false,
            sameSite: "Lax",
            maxAge: this.config.session.ttlSeconds
          });
        }

        return {
          status: "success",
          user,
          token,
          session: { id: session.id, expiresAt: session.expiresAt }
        };
      }
    }, { summary: "Authenticate and start session", tags: ["Authentication"] });

    // 3. GET /auth/me
    scope.route("/auth/me", {
      GET: async (ctx: ApexRequestContext) => {
        const user = (ctx as any).user;
        if (!user) {
          throw new AuthorizationError("Not authenticated");
        }
        return {
          user,
          session: (ctx as any).session
        };
      }
    }, { summary: "Get current authenticated user", tags: ["Authentication"] });

    // 4. POST /auth/logout
    scope.route("/auth/logout", {
      POST: async (ctx: ApexRequestContext) => {
        let token: string | undefined;
        const authHeader = ctx.headers["authorization"];
        if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
          token = authHeader.substring(7).trim();
        }
        if (!token && this.config.session.cookieName) {
          token = ctx.cookies[this.config.session.cookieName];
        }
        if (token) {
          await this.destroySession(token);
        }
        if (this.config.session.cookieName) {
          ctx.cookie(this.config.session.cookieName, "", { maxAge: 0 });
        }
        return { status: "logged_out" };
      }
    }, { summary: "Terminate session", tags: ["Authentication"] });
  }
}

export const auth = new ApexAuthEngine();
