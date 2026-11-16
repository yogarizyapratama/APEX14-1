import http from "node:http";
import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import type { ApexScope, ApexWebSocket, WebSocketHandlers } from "@apex14/core";

export interface NodeServerOptions {
  port?: number;
  host?: string;
  silent?: boolean;
  docs?: boolean;
  docsPath?: string;
  studio?: boolean;
  studioPath?: string;
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

function readNodeBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => resolve(body));
    req.on("error", (err) => reject(err));
  });
}

function toWebRequestWithBody(
  req: http.IncomingMessage,
  host: string,
  port: number,
  body: string
): Request {
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

  return new Request(url, {
    method,
    headers,
    body: body.length > 0 ? body : undefined
  });
}

export async function sendWebResponse(res: Response, nodeRes: http.ServerResponse): Promise<void> {
  const contentType = res.headers.get("content-type") || "";
  const isStreaming =
    contentType.includes("text/event-stream") ||
    res.headers.has("content-disposition") ||
    contentType.includes("application/octet-stream");

  // Format headers for writeHead
  const headersObj: Record<string, string | string[]> = {};
  const setCookies: string[] = [];

  const rawSetCookie = (res.headers as any).getSetCookie
    ? (res.headers as any).getSetCookie()
    : res.headers.get("set-cookie")
      ? [res.headers.get("set-cookie")!]
      : [];

  res.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower === "set-cookie") {
      setCookies.push(value);
    } else {
      headersObj[key] = value;
    }
  });

  if (rawSetCookie.length > 0) {
    headersObj["set-cookie"] = rawSetCookie;
  } else if (setCookies.length > 0) {
    headersObj["set-cookie"] = setCookies;
  }

  if (!res.body) {
    nodeRes.writeHead(res.status, res.statusText, headersObj);
    nodeRes.end();
    return;
  }

  // Node.js Direct Fast-Path: Write JSON/text payloads directly to nodeRes
  if (!isStreaming) {
    try {
      const text = await res.text();
      nodeRes.writeHead(res.status, res.statusText, headersObj);
      nodeRes.end(text);
      return;
    } catch {
      // Fallback to streaming pipeline if text extraction fails
    }
  }

  // Streaming Pipeline: Preserve for SSE (ApexSseResult), file downloads (ApexFileResult) or streams
  nodeRes.writeHead(res.status, res.statusText, headersObj);
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
  const port = options.port !== undefined ? options.port : 3000;
  const host = options.host || "0.0.0.0";

  // Automatically enable interactive docs if requested
  if (options.docs) {
    scope.enableDocs({ docsPath: options.docsPath || "/_docs" });
  }

  // Automatically enable developer studio if requested
  if (options.studio) {
    scope.enableStudio({ path: options.studioPath || "/_studio" });
  }

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, nodeRes) => {
      try {
        const method = req.method?.toUpperCase() || "GET";
        let webReq: Request;
        const contentType = req.headers["content-type"] || "";

        if (method === "GET" || method === "HEAD") {
          webReq = toWebRequest(req, host, port);
        } else if (
          contentType.includes("application/json") ||
          contentType.includes("text/plain") ||
          contentType.includes("application/x-www-form-urlencoded")
        ) {
          const bodyStr = await readNodeBody(req);
          webReq = toWebRequestWithBody(req, host, port, bodyStr);
        } else {
          webReq = toWebRequest(req, host, port);
        }

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

    // WebSocket server integration
    const wss = new WebSocketServer({ noServer: true });
    const rooms = new Map<string, Set<ApexWebSocket>>();

    server.on("upgrade", (req, socket, head) => {
      const parsedUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
      const pathname = parsedUrl.pathname;

      let matchedHandlers: WebSocketHandlers | undefined;
      const params: Record<string, string> = {};

      for (const [routePattern, handlers] of scope.wsRoutes.entries()) {
        const regexStr = "^" + routePattern.replace(/:([a-zA-Z0-9_]+)/g, "(?<$1>[^/]+)") + "$";
        const regex = new RegExp(regexStr);
        const match = pathname.match(regex);
        if (match) {
          matchedHandlers = handlers;
          if (match.groups) Object.assign(params, match.groups);
          break;
        }
      }

      if (!matchedHandlers) {
        socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
        socket.destroy();
        return;
      }

      wss.handleUpgrade(req, socket, head, (client) => {
        const apexWs: ApexWebSocket = {
          id: randomUUID(),
          params,
          data: {},
          send(data) {
            if (client.readyState === WebSocket.OPEN) {
              client.send(typeof data === "string" || data instanceof Uint8Array ? data : JSON.stringify(data));
            }
          },
          close(code, reason) {
            client.close(code, reason);
          },
          join(room) {
            if (!rooms.has(room)) rooms.set(room, new Set());
            rooms.get(room)!.add(apexWs);
          },
          leave(room) {
            rooms.get(room)?.delete(apexWs);
          },
          publish(room, message) {
            const members = rooms.get(room);
            if (members) {
              const payload = typeof message === "string" || message instanceof Uint8Array ? message : JSON.stringify(message);
              for (const member of members) {
                if (member !== apexWs) {
                  member.send(payload);
                }
              }
            }
          }
        };

        if (matchedHandlers?.open) {
          matchedHandlers.open(apexWs);
        }

        client.on("message", (data) => {
          let parsed: any = data;
          try {
            parsed = JSON.parse(data.toString());
          } catch {
            parsed = data.toString();
          }
          matchedHandlers?.message?.(apexWs, parsed);
        });

        client.on("close", (code, reason) => {
          for (const members of rooms.values()) {
            members.delete(apexWs);
          }
          matchedHandlers?.close?.(apexWs, code, reason.toString());
        });

        client.on("error", (err) => {
          matchedHandlers?.error?.(apexWs, err);
        });
      });
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
        if (options.docs) {
          console.log(`• Interactive Docs: ${url}${options.docsPath || "/_docs"}`);
        }
        if (options.studio) {
          console.log(`• Developer Studio: ${url}${options.studioPath || "/_studio"}`);
        }
      }

      // Register graceful shutdown
      const shutdown = async () => {
        wss.close();
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
