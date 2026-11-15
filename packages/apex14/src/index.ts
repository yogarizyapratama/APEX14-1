// Direct Function API
export {
  route,
  group,
  use,
  guard,
  secure,
  inject,
  getService,
  handle,
  testRequest,
  createScope,
  withScope,
  ApexScope
} from "@apex14/core";

// Universal launcher
export { run, type RunOptions } from "./launcher.js";

// Validation & TypeBox
export { Type, validateSchema, validateOrThrow } from "@apex14/validation";
export type { Static, TSchema } from "@apex14/validation";

// Security
export {
  Jwt,
  hashPassword,
  verifyPassword,
  rateLimit,
  securityHeaders,
  cors,
  validateSafeUrl,
  assertSafeUrl
} from "@apex14/security";

// Storage & Files
export { file, store, configureStorage } from "@apex14/storage";

// Database & Resources
export { db, configureDatabase, resource, SqliteDatabaseClient } from "@apex14/database";

// HTTP Primitives & Errors
export {
  ApexRequestContext,
  ApexError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ApexRedirect,
  ApexFileResult
} from "@apex14/http";
