import { ApexRequestContext, ApexSseResult } from "@apex14/http";
import type { Handler, MethodMap, RouteOptions } from "./types.js";

export interface AgentMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  toolCallId?: string;
  toolCalls?: Array<{ id: string; name: string; arguments: any }>;
}

export interface AgentTool {
  name: string;
  description?: string;
  parameters?: any;
  execute: (args: any, ctx?: ApexRequestContext) => Promise<any> | any;
}

export interface AgentResponse {
  content: string;
  toolCalls?: Array<{ id: string; name: string; arguments: any }>;
  usage?: { promptTokens?: number; completionTokens?: number };
}

export interface AgentConfig {
  model?: string;
  system?: string;
  tools?: Array<AgentTool | any>;
  memory?: {
    strategy?: "session" | "memory";
    maxTurns?: number;
  };
  temperature?: number;
  provider?: (messages: AgentMessage[], tools: AgentTool[], ctx?: ApexRequestContext) => Promise<AgentResponse>;
}

export class ApexAgent {
  public name: string;
  public config: AgentConfig;
  public tools = new Map<string, AgentTool>();
  private conversationHistory = new Map<string, AgentMessage[]>();

  constructor(name: string, config: AgentConfig = {}) {
    this.name = name;
    this.config = {
      model: "default-model",
      system: "You are an intelligent autonomous AI assistant powered by APEX14.",
      tools: [],
      temperature: 0.7,
      ...config
    };

    if (config.tools) {
      for (const t of config.tools) {
        if (typeof t === "object" && t.name && typeof t.execute === "function") {
          this.tools.set(t.name, t);
        } else if (typeof t === "object" && t.name && typeof t.dispatch === "function") {
          // Auto-adapt APEX14 task() queue to AI tool
          this.tools.set(t.name, {
            name: t.name,
            description: `APEX14 Background Task: ${t.name}`,
            execute: async (args: any) => await t.dispatch(args)
          });
        }
      }
    }
  }

  public registerTool(tool: AgentTool): this {
    this.tools.set(tool.name, tool);
    return this;
  }

  public async run(userInput: string, ctx?: ApexRequestContext, sessionId: string = "default"): Promise<AgentResponse> {
    const history = this.getHistory(sessionId);

    // Initial system prompt if history empty
    if (history.length === 0 && this.config.system) {
      history.push({ role: "system", content: this.config.system });
    }

    history.push({ role: "user", content: userInput });

    const toolsList = Array.from(this.tools.values());

    let response: AgentResponse;
    if (this.config.provider) {
      response = await this.config.provider(history, toolsList, ctx);
    } else {
      response = await this.defaultMockProvider(history, toolsList, ctx);
    }

    // Process tool calls if requested
    if (response.toolCalls && response.toolCalls.length > 0) {
      history.push({
        role: "assistant",
        content: response.content || "",
        toolCalls: response.toolCalls
      });

      for (const tc of response.toolCalls) {
        const tool = this.tools.get(tc.name);
        let toolResult: any;
        if (tool) {
          try {
            toolResult = await tool.execute(tc.arguments, ctx);
          } catch (err: any) {
            toolResult = { error: err.message || String(err) };
          }
        } else {
          toolResult = { error: `Tool '${tc.name}' not found` };
        }

        history.push({
          role: "tool",
          name: tc.name,
          toolCallId: tc.id,
          content: typeof toolResult === "string" ? toolResult : JSON.stringify(toolResult)
        });
      }

      // Re-invoke provider after tools execution to generate final summary
      if (this.config.provider) {
        response = await this.config.provider(history, toolsList, ctx);
      } else {
        response = await this.defaultMockProvider(history, toolsList, ctx);
      }
    }

    history.push({ role: "assistant", content: response.content });

    const maxTurns = (this.config.memory?.maxTurns || 20) * 2;
    if (history.length > maxTurns) {
      // Keep system prompt + slice rest
      const sys = history[0]?.role === "system" ? [history[0]] : [];
      this.conversationHistory.set(sessionId, [...sys, ...history.slice(-maxTurns)]);
    }

    return response;
  }

  public handle(): MethodMap {
    const fn = async (ctx: ApexRequestContext) => {
      const input = ctx.body?.prompt || ctx.body?.message || ctx.body?.input || ctx.query.prompt || "";
      const sessionId = ctx.body?.sessionId || ctx.headers["x-session-id"] || ctx.query.sessionId || "default";
      const result = await this.run(input, ctx, sessionId);
      return {
        agent: this.name,
        model: this.config.model,
        result
      };
    };
    return {
      GET: fn,
      POST: fn
    };
  }

  public handleStream(): MethodMap {
    const fn = async (ctx: ApexRequestContext) => {
      const input = ctx.body?.prompt || ctx.body?.message || ctx.body?.input || ctx.query.prompt || "";
      const sessionId = ctx.body?.sessionId || ctx.headers["x-session-id"] || ctx.query.sessionId || "default";
      const agent = this;

      async function* generateStream() {
        yield { type: "start", agent: agent.name, model: agent.config.model };
        const res = await agent.run(input, ctx, sessionId);

        if (res.toolCalls) {
          for (const tc of res.toolCalls) {
            yield { type: "tool_call", name: tc.name, arguments: tc.arguments };
          }
        }

        // Chunk output tokens
        const words = res.content.split(" ");
        for (const w of words) {
          yield { type: "token", text: w + " " };
        }

        yield { type: "done", content: res.content };
      }

      return new ApexSseResult(generateStream());
    };
    return {
      GET: fn,
      POST: fn
    };
  }

  private getHistory(sessionId: string): AgentMessage[] {
    let hist = this.conversationHistory.get(sessionId);
    if (!hist) {
      hist = [];
      this.conversationHistory.set(sessionId, hist);
    }
    return hist;
  }

  private async defaultMockProvider(
    messages: AgentMessage[],
    tools: AgentTool[],
    ctx?: ApexRequestContext
  ): Promise<AgentResponse> {
    const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content || "";
    const lower = lastUser.toLowerCase();

    // Check if user is asking for any registered tool
    for (const tool of tools) {
      if (lower.includes(tool.name.toLowerCase())) {
        return {
          content: `Executing ${tool.name}`,
          toolCalls: [
            {
              id: `call_${Math.random().toString(36).substring(2, 8)}`,
              name: tool.name,
              arguments: { query: lastUser }
            }
          ]
        };
      }
    }

    // After tool output
    const lastTool = [...messages].reverse().find((m) => m.role === "tool");
    if (lastTool) {
      return {
        content: `Tool ${lastTool.name} returned: ${lastTool.content}`
      };
    }

    return {
      content: `[APEX14 Agent ${this.name}]: Processed input "${lastUser}" successfully.`
    };
  }
}

export function agent(name: string, config: AgentConfig = {}): ApexAgent {
  return new ApexAgent(name, config);
}
