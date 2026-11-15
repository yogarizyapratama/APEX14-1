# APEX14 — Native AI & MCP (Model Context Protocol) Bridge

APEX14 is the **first API framework with native Model Context Protocol (MCP) support**, enabling AI Agents (Claude Desktop, Cursor, Gemini, OpenAI ChatGPT Actions, LangChain) to discover and call your routes as native agent tools with **zero extra code**.

---

## 1. Tagging Routes as AI Tools

Simply add `aiTool: true` to route options:

```ts
import { route, exportMcpTools, Type, run } from "apex14";

route("/weather", {
  POST: ({ body }) => {
    return {
      city: body.city,
      temp: 28,
      condition: "Sunny",
      humidity: "65%"
    };
  }
}, {
  summary: "Get current weather for a city",
  description: "Retrieves temperature and weather conditions given a city name",
  body: Type.Object({
    city: Type.String({ description: "The name of the target city (e.g. Jakarta, Tokyo)" })
  }),
  aiTool: true // Tag as AI Tool
});

// Expose standard MCP server endpoint for AI Agents
route("/mcp", exportMcpTools());

run(3000);
```

---

## 2. Connecting AI Agents to APEX14

Your APEX14 server now speaks standard JSON-RPC 2.0 MCP Protocol:

### Discovering Tools (`tools/list`)
Send `POST /mcp` with:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list"
}
```
**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "post_weather",
        "description": "Get current weather for a city",
        "inputSchema": {
          "type": "object",
          "properties": {
            "city": { "type": "string", "description": "The name of the target city" }
          }
        }
      }
    ]
  }
}
```

### Invoking Tools (`tools/call`)
Send `POST /mcp` with:
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "post_weather",
    "arguments": { "city": "Tokyo" }
  }
}
```
**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\n  \"city\": \"Tokyo\",\n  \"temp\": 28,\n  \"condition\": \"Sunny\"\n}"
      }
    ]
  }
}
```
