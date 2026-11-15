# Autonomous AI Agent Runtime (`agent`)

APEX14 features a native autonomous AI agent engine that makes your API functions, database models, and background tasks automatically callable by LLMs without relying on external orchestration bloatware like LangChain.

---

## 1. Quick Example

```ts
import { agent, route, task } from "apex14";

// 1. Any APEX14 task or custom function is an AI tool
const calculateShipping = task("calculate-shipping", async ({ destination, weight }) => {
  return { cost: 15.5, estimatedDays: 2 };
});

// 2. Define Autonomous Agent
const logisticsAgent = agent("logistics-specialist", {
  system: "You are an AI logistics specialist assisting customers with order fulfillment.",
  model: "gemini-2.0-flash",
  tools: [calculateShipping]
});

// 3. Mount directly to route with standard response or SSE streaming
route("/api/logistics/chat", logisticsAgent.handleStream());
```

---

## 2. Tool Reflection & Execution Loop

When a user prompt requires tool execution:
1. The agent detects the required tool and arguments.
2. APEX14 automatically invokes `tool.execute(args, ctx)`.
3. The tool output is fed back to the model for final synthesis.
4. Token chunks and tool events are streamed directly to the frontend over Server-Sent Events (SSE).

---

## 3. Streaming Event Format

Clients subscribing to `agent.handleStream()` receive structured SSE packets:
```json
data: {"type":"start","agent":"logistics-specialist"}
data: {"type":"tool_call","name":"calculateShipping","arguments":{"destination":"Tokyo","weight":2}}
data: {"type":"token","text":"Shipping "}
data: {"type":"token","text":"cost "}
data: {"type":"token","text":"is "}
data: {"type":"token","text":"$15.50."}
data: {"type":"done","content":"Shipping cost is $15.50."}
```
