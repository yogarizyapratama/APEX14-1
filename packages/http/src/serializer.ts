import { ApexRequestContext, ApexRedirect, ApexFileResult, ApexSseResult } from "./context.js";
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

  // 4. Server-Sent Events (SSE) Result or AsyncIterable
  if (value instanceof ApexSseResult || (value && typeof (value as any)[Symbol.asyncIterator] === "function")) {
    const asyncIterable = value instanceof ApexSseResult ? value.stream : value;
    const encoder = new TextEncoder();
    const headers = new Headers(ctx.responseHeaders);
    headers.set("content-type", "text/event-stream; charset=utf-8");
    headers.set("cache-control", "no-cache, no-transform");
    headers.set("connection", "keep-alive");
    headers.set("x-accel-buffering", "no");

    if (value instanceof ApexSseResult && value.options?.headers) {
      new Headers(value.options.headers).forEach((v, k) => headers.set(k, v));
    }

    for (const c of ctx.getSetCookieHeaders()) {
      headers.append("set-cookie", c);
    }

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of asyncIterable) {
            let msg = "";
            if (typeof chunk === "string") {
              msg = `data: ${chunk}\n\n`;
            } else if (chunk && typeof chunk === "object" && ("data" in chunk || "event" in chunk)) {
              if (chunk.id) msg += `id: ${chunk.id}\n`;
              if (chunk.event) msg += `event: ${chunk.event}\n`;
              if (chunk.retry) msg += `retry: ${chunk.retry}\n`;
              const dataStr = typeof chunk.data === "string" ? chunk.data : JSON.stringify(chunk.data);
              msg += `data: ${dataStr}\n\n`;
            } else {
              msg = `data: ${JSON.stringify(chunk)}\n\n`;
            }
            controller.enqueue(encoder.encode(msg));
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      }
    });

    return new Response(stream, {
      status: value instanceof ApexSseResult && value.options?.status ? value.options.status : ctx.responseStatus,
      headers
    });
  }

  // 5. ReadableStream
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
