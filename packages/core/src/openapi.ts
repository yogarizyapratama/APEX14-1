import type { RouteOptions } from "./types.js";
import type { ApexScope } from "./scope.js";

export interface RouteManifestEntry {
  path: string;
  method: string;
  handler: any;
  options: RouteOptions;
}

export function generateOpenApiSpec(
  routes: RouteManifestEntry[],
  info: { title?: string; version?: string; description?: string } = {}
): Record<string, any> {
  const paths: Record<string, any> = {};

  for (const r of routes) {
    // Skip internal docs routes
    if (r.path.startsWith("/_") || r.path === "/mcp") continue;

    // Convert :param to {param} for OpenAPI standard
    const openApiPath = r.path.replace(/:([a-zA-Z0-9_]+)/g, "{$1}");

    if (!paths[openApiPath]) {
      paths[openApiPath] = {};
    }

    const methodLower = r.method.toLowerCase();
    const parameters: any[] = [];

    // Path parameters
    const pathMatches = r.path.match(/:([a-zA-Z0-9_]+)/g);
    if (pathMatches) {
      for (const m of pathMatches) {
        const paramName = m.slice(1);
        parameters.push({
          name: paramName,
          in: "path",
          required: true,
          schema: { type: "string" }
        });
      }
    }

    // Query parameters
    if (r.options.query && typeof r.options.query === "object" && r.options.query.properties) {
      for (const [key, prop] of Object.entries(r.options.query.properties)) {
        const isRequired = Array.isArray(r.options.query.required) && r.options.query.required.includes(key);
        parameters.push({
          name: key,
          in: "query",
          required: isRequired,
          schema: prop
        });
      }
    }

    const operation: Record<string, any> = {
      summary: r.options.summary || `${r.method} ${r.path}`,
      description: r.options.description || "",
      tags: r.options.tags || ["Default"],
      parameters: parameters.length > 0 ? parameters : undefined,
      responses: {
        "200": {
          description: "Successful response",
          content: {
            "application/json": {
              schema: r.options.response || { type: "object" }
            }
          }
        }
      }
    };

    // Request Body
    if (r.options.body && ["post", "put", "patch"].includes(methodLower)) {
      operation.requestBody = {
        required: true,
        content: {
          "application/json": {
            schema: r.options.body
          }
        }
      };
    }

    paths[openApiPath][methodLower] = operation;
  }

  return {
    openapi: "3.1.0",
    info: {
      title: info.title || "APEX14 API",
      version: info.version || "1.0.0",
      description: info.description || "Interactive API Documentation powered by APEX14"
    },
    paths
  };
}

export function renderDocsHtml(specUrl: string = "/_openapi.json", title: string = "APEX14 API Reference"): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⚡</text></svg>">
    <style>
      body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    </style>
  </head>
  <body>
    <script
      id="api-reference"
      data-url="${specUrl}"
      data-configuration='{"theme": "purple", "darkMode": true, "showSidebar": true}'>
    </script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`;
}

export function createMcpHandler(scope: ApexScope): (ctx: any) => Promise<any> {
  return async (ctx) => {
    const body = ctx.body || {};
    const method = body.method;
    const id = body.id ?? 1;

    // Filter routes eligible for AI tools (tagged with aiTool: true, or routes with schemas/summaries)
    const routes = scope.routesManifest.filter((r) => r.options.aiTool || r.options.summary || r.options.body);

    if (method === "tools/list") {
      const tools = routes.map((r) => {
        const cleanName = `${r.method.toLowerCase()}_${r.path.replace(/[^a-zA-Z0-9]/g, "_").replace(/^_+|_+$/g, "")}`;
        const inputProperties: Record<string, any> = {};

        if (r.options.body && typeof r.options.body === "object" && r.options.body.properties) {
          Object.assign(inputProperties, r.options.body.properties);
        }
        if (r.options.query && typeof r.options.query === "object" && r.options.query.properties) {
          Object.assign(inputProperties, r.options.query.properties);
        }
        if (r.options.params && typeof r.options.params === "object" && r.options.params.properties) {
          Object.assign(inputProperties, r.options.params.properties);
        }

        return {
          name: cleanName,
          description: r.options.description || r.options.summary || `${r.method} ${r.path}`,
          inputSchema: {
            type: "object",
            properties: inputProperties
          }
        };
      });

      return {
        jsonrpc: "2.0",
        id,
        result: { tools }
      };
    }

    if (method === "tools/call") {
      const toolName = body.params?.name;
      const args = body.params?.arguments || {};

      const matchedRoute = routes.find((r) => {
        const cleanName = `${r.method.toLowerCase()}_${r.path.replace(/[^a-zA-Z0-9]/g, "_").replace(/^_+|_+$/g, "")}`;
        return cleanName === toolName;
      });

      if (!matchedRoute) {
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Tool '${toolName}' not found` }
        };
      }

      try {
        // Execute route handler by invoking testRequest
        const fakeRequest = new Request(`http://localhost${matchedRoute.path}`, {
          method: matchedRoute.method,
          headers: { "content-type": "application/json" },
          body: ["POST", "PUT", "PATCH"].includes(matchedRoute.method) ? JSON.stringify(args) : undefined
        });

        const res = await scope.handle(fakeRequest);
        const resultData = await res.json().catch(() => res.text());

        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: typeof resultData === "string" ? resultData : JSON.stringify(resultData, null, 2)
              }
            ]
          }
        };
      } catch (err: any) {
        return {
          jsonrpc: "2.0",
          id,
          result: {
            isError: true,
            content: [{ type: "text", text: `Execution failed: ${err.message}` }]
          }
        };
      }
    }

    // Default MCP info
    return {
      jsonrpc: "2.0",
      id,
      result: {
        server: { name: "apex14-mcp-bridge", version: "0.1.0" },
        capabilities: { tools: {} }
      }
    };
  };
}
