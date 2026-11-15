import { ApexRequestContext, ApexRedirect, ApexFileResult } from "./context.js";
import { ApexError } from "./errors.js";

export function serializeResponse(value: any, ctx: ApexRequestContext): Response {
  // 1. If it's already a native Web standard Response, merge headers/cookies and return
  if (value instanceof Response) {
    const resHeaders = new Headers(value.headers);
    // Merge context headers
    ctx.responseHeaders.forEach((v, k) => {
      resHeaders.set(k, v);
    });
    for (const c of ctx.getSetCookieHeaders()) {
      resHeaders.append("set-cookie", c);
    }
    return new Response(value.body, {
      status: ctx.responseStatus !== 200 ? ctx.responseStatus : value.status,
      statusText: value.statusText,
      headers: resHeaders
    });
  }

  // 2. Redirect Result
  if (value instanceof ApexRedirect) {
    const headers = new Headers(ctx.responseHeaders);
    headers.set("location", value.url);
    for (const c of ctx.getSetCookieHeaders()) {
      headers.append("set-cookie", c);
    }
    return new Response(null, {
      status: value.status,
      headers
    });
  }

  // 3. File Result
  if (value instanceof ApexFileResult) {
    const headers = new Headers(ctx.responseHeaders);
    headers.set("content-type", value.contentType);
    headers.set("content-disposition", `attachment; filename="${encodeURIComponent(value.filename)}"`);
    for (const c of ctx.getSetCookieHeaders()) {
      headers.append("set-cookie", c);
    }
    return new Response(value.data as any, {
      status: value.status,
      headers
    });
  }

  // 4. ReadableStream
  if (value instanceof ReadableStream) {
    const headers = new Headers(ctx.responseHeaders);
    if (!headers.has("content-type")) {
      headers.set("content-type", "application/octet-stream");
    }
    for (const c of ctx.getSetCookieHeaders()) {
      headers.append("set-cookie", c);
    }
    return new Response(value, {
      status: ctx.responseStatus,
      headers
    });
  }

  // 5. Undefined or Null
  if (value === undefined) {
    const headers = new Headers(ctx.responseHeaders);
    for (const c of ctx.getSetCookieHeaders()) {
      headers.append("set-cookie", c);
    }
    const status = ctx.responseStatus === 200 ? 204 : ctx.responseStatus;
    return new Response(null, {
      status,
      headers
    });
  }

  if (value === null) {
    const headers = new Headers(ctx.responseHeaders);
    headers.set("content-type", "application/json; charset=utf-8");
    for (const c of ctx.getSetCookieHeaders()) {
      headers.append("set-cookie", c);
    }
    return new Response("null", {
      status: ctx.responseStatus,
      headers
    });
  }

  // 6. String
  if (typeof value === "string") {
    const headers = new Headers(ctx.responseHeaders);
    if (!headers.has("content-type")) {
      const trimmed = value.trim();
      if (trimmed.startsWith("<") && trimmed.endsWith(">")) {
        headers.set("content-type", "text/html; charset=utf-8");
      } else {
        headers.set("content-type", "text/plain; charset=utf-8");
      }
    }
    for (const c of ctx.getSetCookieHeaders()) {
      headers.append("set-cookie", c);
    }
    return new Response(value, {
      status: ctx.responseStatus,
      headers
    });
  }

  // 7. Number or Boolean or Array or Object -> JSON response
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "object"
  ) {
    const headers = new Headers(ctx.responseHeaders);
    headers.set("content-type", "application/json; charset=utf-8");
    for (const c of ctx.getSetCookieHeaders()) {
      headers.append("set-cookie", c);
    }
    return new Response(JSON.stringify(value), {
      status: ctx.responseStatus,
      headers
    });
  }

  // Fallback
  const headers = new Headers(ctx.responseHeaders);
  for (const c of ctx.getSetCookieHeaders()) {
    headers.append("set-cookie", c);
  }
  return new Response(String(value), {
    status: ctx.responseStatus,
    headers
  });
}

export function serializeErrorResponse(error: any): Response {
  if (error instanceof ApexError) {
    return new Response(JSON.stringify(error.toJSON()), {
      status: error.status,
      headers: {
        "content-type": "application/json; charset=utf-8"
      }
    });
  }

  const message = error instanceof Error ? error.message : "Internal Server Error";
  const body = {
    error: {
      message,
      code: "INTERNAL_ERROR",
      status: 500
    }
  };

  return new Response(JSON.stringify(body), {
    status: 500,
    headers: {
      "content-type": "application/json; charset=utf-8"
    }
  });
}
