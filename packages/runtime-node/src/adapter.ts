import http from "node:http";
import { Readable } from "node:stream";
import type { ApexScope } from "@apex14/core";

export interface NodeServerOptions {
  port?: number;
  host?: string;
  silent?: boolean;
}

export interface NodeServerHandle {
  server: http.Server;
  port: number;
  host: string;
  url: string;
  close: () => Promise<void>;
}

export function toWebRequest(req: http.IncomingMessage, host: string, port: number): Request {
  const protocol = (req.socket as any).encrypted ? "https" : "http";
  const url = `${protocol}://${req.headers.host || `${host}:${port}`}${req.url || "/"}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.set(key, value);
    }
  }

  const method = req.method?.toUpperCase() || "GET";
  const hasBody = method !== "GET" && method !== "HEAD";

  let body: ReadableStream<Uint8Array> | null = null;
  if (hasBody) {
    body = new ReadableStream({
      start(controller) {
        req.on("data", (chunk) => controller.enqueue(chunk));
        req.on("end", () => controller.close());
        req.on("error", (err) => controller.error(err));
      }
    });
  }

  return new Request(url, {
    method,
    headers,
    body,
    // @ts-ignore duplex is required in Node for streaming request bodies
    duplex: hasBody ? "half" : undefined
  });
}

export async function sendWebResponse(res: Response, nodeRes: http.ServerResponse): Promise<void> {
  nodeRes.statusCode = res.status;
  nodeRes.statusMessage = res.statusText;

  // Set-Cookie handling
  const setCookie = (res.headers as any).getSetCookie
    ? (res.headers as any).getSetCookie()
    : res.headers.get("set-cookie")
      ? [res.headers.get("set-cookie")!]
      : [];

  res.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "set-cookie") {
      nodeRes.setHeader(key, value);
    }
  });

  if (setCookie.length > 0) {
    nodeRes.setHeader("set-cookie", setCookie);
  }

  if (!res.body) {
    nodeRes.end();
    return;
  }

  // Stream web response body to node response
  const reader = res.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        nodeRes.write(value);
      }
    }
    nodeRes.end();
  } catch (err) {
    nodeRes.destroy(err as Error);
  } finally {
    reader.releaseLock();
  }
}

export function listenNode(
  scope: ApexScope,
  options: NodeServerOptions = {}
): Promise<NodeServerHandle> {
  const port = options.port || 3000;
  const host = options.host || "0.0.0.0";

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, nodeRes) => {
      try {
        const webReq = toWebRequest(req, host, port);
        const webRes = await scope.handle(webReq);
        await sendWebResponse(webRes, nodeRes);
      } catch (err: any) {
        if (!nodeRes.headersSent) {
          nodeRes.statusCode = 500;
          nodeRes.setHeader("content-type", "application/json");
          nodeRes.end(JSON.stringify({ error: { message: err.message, status: 500 } }));
        }
      }
    });

    server.on("error", (err) => {
      reject(err);
    });

    server.listen(port, host, () => {
      const addr = server.address();
      const actualPort = typeof addr === "object" && addr ? addr.port : port;
      const displayHost = host === "0.0.0.0" ? "localhost" : host;
      const url = `http://${displayHost}:${actualPort}`;

      if (!options.silent) {
        console.log(`▲ APEX14 — The Intelligent API Framework`);
        console.log(`• Server listening on ${url}`);
        console.log(`• Runtime: Node.js (${process.version})`);
      }

      // Register graceful shutdown
      const shutdown = async () => {
        await new Promise<void>((res) => server.close(() => res()));
      };

      resolve({
        server,
        port: actualPort,
        host,
        url,
        close: shutdown
      });
    });
  });
}
