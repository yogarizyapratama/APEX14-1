import { ValidationError } from "./errors.js";

export async function parseRequestBody(request: Request): Promise<{ body: any; files: Record<string, any> }> {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD") {
    return { body: undefined, files: {} };
  }

  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      const text = await request.text();
      if (!text.trim()) {
        return { body: undefined, files: {} };
      }
      const parsed = JSON.parse(text, (key, value) => {
        // Prototype pollution guard
        if (key === "__proto__" || key === "constructor" || key === "prototype") {
          return undefined;
        }
        return value;
      });
      return { body: parsed, files: {} };
    } catch (err: any) {
      throw new ValidationError(`Malformed JSON payload: ${err.message}`);
    }
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await request.text();
    const params = new URLSearchParams(text);
    const body: Record<string, any> = {};
    params.forEach((v, k) => {
      if (body[k] !== undefined) {
        if (Array.isArray(body[k])) {
          body[k].push(v);
        } else {
          body[k] = [body[k], v];
        }
      } else {
        body[k] = v;
      }
    });
    return { body, files: {} };
  }

  if (contentType.includes("multipart/form-data")) {
    try {
      const formData = await request.formData();
      const body: Record<string, any> = {};
      const files: Record<string, any> = {};

      formData.forEach((value, key) => {
        if (typeof value === "string") {
          body[key] = value;
        } else if (value instanceof Blob) {
          files[key] = value;
        }
      });
      return { body, files };
    } catch (err: any) {
      throw new ValidationError(`Failed to parse multipart form data: ${err.message}`);
    }
  }

  if (contentType.includes("text/")) {
    const text = await request.text();
    return { body: text, files: {} };
  }

  return { body: undefined, files: {} };
}
