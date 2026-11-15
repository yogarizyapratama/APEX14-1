import { Type, type TSchema, type Static, FormatRegistry } from "@sinclair/typebox";
import { TypeCompiler } from "@sinclair/typebox/compiler";
import { Value } from "@sinclair/typebox/value";
import { ValidationError } from "@apex14/http";

// Register common standard JSON Schema formats
if (!FormatRegistry.Has("email")) {
  FormatRegistry.Set("email", (value) =>
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(value)
  );
}

if (!FormatRegistry.Has("uuid")) {
  FormatRegistry.Set("uuid", (value) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

if (!FormatRegistry.Has("date-time")) {
  FormatRegistry.Set("date-time", (value) => !isNaN(Date.parse(value)));
}

if (!FormatRegistry.Has("url")) {
  FormatRegistry.Set("url", (value) => {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  });
}

if (!FormatRegistry.Has("ipv4")) {
  FormatRegistry.Set("ipv4", (value) =>
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(value)
  );
}

export interface ValidationErrorDetail {
  path: string;
  message: string;
  value?: any;
  type?: string;
}

const compilerCache = new WeakMap<TSchema, ReturnType<typeof TypeCompiler.Compile>>();

export function getCompiledValidator(schema: TSchema) {
  let compiled = compilerCache.get(schema);
  if (!compiled) {
    compiled = TypeCompiler.Compile(schema);
    compilerCache.set(schema, compiled);
  }
  return compiled;
}

export function validateSchema<T extends TSchema>(
  schema: T,
  data: unknown
): { valid: boolean; errors?: ValidationErrorDetail[]; value: Static<T> } {
  const validator = getCompiledValidator(schema);
  const isValid = validator.Check(data);

  if (isValid) {
    return { valid: true, value: data as Static<T> };
  }

  const errors: ValidationErrorDetail[] = [];
  for (const err of validator.Errors(data)) {
    errors.push({
      path: err.path,
      message: err.message,
      value: err.value,
      type: err.type.toString()
    });
  }

  return { valid: false, errors, value: data as Static<T> };
}

export function validateOrThrow<T extends TSchema>(
  schema: T,
  data: unknown,
  target: string = "body"
): Static<T> {
  const result = validateSchema(schema, data);
  if (!result.valid) {
    const detailMsg = result.errors && result.errors.length > 0
      ? `${result.errors[0]?.path || target}: ${result.errors[0]?.message}`
      : "Validation failed";
    throw new ValidationError(`Invalid request ${target} — ${detailMsg}`, result.errors);
  }
  return result.value;
}

export { Type, type TSchema, type Static, Value };
