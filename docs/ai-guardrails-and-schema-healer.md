# Native AI Prompt Injection Defense & Output Schema Healer (`guardrail`)

LLM integrations are exposed to prompt injection attacks (*jailbreaks*) on the input side, and malformed JSON with Markdown formatting on the output side. APEX14 provides a built-in AI firewall.

---

## 1. Prompt Injection & Jailbreak Defense

Detect adversarial attack vectors like `"ignore all previous instructions"`, `"dan mode"`, or system prompt overrides:

```ts
import { guardrail, route } from "apex14";

route("/api/ai/chat", async (ctx) => {
  // Throws ValidationError (HTTP 400) if prompt injection patterns are detected
  guardrail.assertSafePrompt(ctx.body.userMessage);

  return await callLlm(ctx.body.userMessage);
});
```

---

## 2. Markdown Stripping & JSON Healing

When LLMs wrap responses in ````json ... ```` code blocks or emit trailing commas (`{ "status": "ok", }`), standard `JSON.parse` crashes. `guardrail.repairAndValidate()` sanitizes and repairs the syntax:

```ts
import { guardrail, Type } from "apex14";

const SummarySchema = Type.Object({
  sentiment: Type.Union([Type.Literal("positive"), Type.Literal("negative")]),
  score: Type.Number()
});

// Strips markdown fences, repairs trailing commas, and validates against TypeBox
const validated = guardrail.repairAndValidate(rawLlmString, SummarySchema);
```
