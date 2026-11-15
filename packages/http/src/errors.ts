export class ApexError extends Error {
  public status: number;
  public code: string;
  public details?: any;

  constructor(status: number, message: string, code: string = "APEX_ERROR", details?: any) {
    super(message);
    this.name = "ApexError";
    this.status = status;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  public toJSON() {
    return {
      error: {
        message: this.message,
        code: this.code,
        status: this.status,
        ...(this.details !== undefined ? { details: this.details } : {})
      }
    };
  }
}

export class ValidationError extends ApexError {
  constructor(message: string = "Validation failed", details?: any) {
    super(400, message, "VALIDATION_ERROR", details);
    this.name = "ValidationError";
  }
}

export class AuthenticationError extends ApexError {
  constructor(message: string = "Authentication required", details?: any) {
    super(401, message, "UNAUTHORIZED", details);
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends ApexError {
  constructor(message: string = "Access denied", details?: any) {
    super(403, message, "FORBIDDEN", details);
    this.name = "AuthorizationError";
  }
}

export class NotFoundError extends ApexError {
  constructor(message: string = "Resource not found", details?: any) {
    super(404, message, "NOT_FOUND", details);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends ApexError {
  constructor(message: string = "Resource conflict", details?: any) {
    super(409, message, "CONFLICT", details);
    this.name = "ConflictError";
  }
}

export class RateLimitError extends ApexError {
  public retryAfterSeconds?: number;

  constructor(message: string = "Too many requests", retryAfterSeconds?: number) {
    super(429, message, "RATE_LIMIT_EXCEEDED", { retryAfter: retryAfterSeconds });
    this.name = "RateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class InternalError extends ApexError {
  constructor(message: string = "Internal server error", details?: any) {
    super(500, message, "INTERNAL_ERROR", details);
    this.name = "InternalError";
  }
}
