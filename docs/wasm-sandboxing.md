# Native WebAssembly Isolated Sandbox (`wasm`)

Executing third-party scripts, user-uploaded plugins, heavy mathematical transforms, or untrusted algorithms directly in the main server event loop poses severe security and denial-of-service risks.

APEX14 provides a built-in WebAssembly sandbox engine with execution deadlines and memory isolation.

---

## 1. Compiling & Executing Wasm Bytecode

```ts
import { wasm, route } from "apex14";

// Load wasm from buffer, Uint8Array, or base64 string
const sandbox = await wasm.load(wasmBinary, {
  timeoutMs: 2500 // Halts execution if guest code deadlocks or loops indefinitely
});

route("/api/calculate-tax", async (ctx) => {
  const { netIncome, countryCode } = ctx.body;
  // Execute exported guest function in isolated sandbox
  const tax = await sandbox.run<number>("calculate_tax", netIncome, countryCode);
  return { netIncome, tax };
});
```

---

## 2. Memory Isolation & Safe Host Interop

Guest memory is strictly bound within its WebAssembly linear memory pool:

```ts
// Read UTF-8 strings directly from sandbox memory
const message = sandbox.readString(pointerOffset);

// Write UTF-8 string into sandbox memory
sandbox.writeString(inputBufferOffset, "payload to process");
```

---

## 3. High-Security Edge Execution

Because APEX14's `wasm` primitive is standard W3C WebAssembly, it compiles and executes universally across Node.js, Bun, Cloudflare Workers, Deno, and V8 edge nodes without native C++ compilation or external daemon dependencies.
