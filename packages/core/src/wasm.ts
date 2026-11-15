/// <reference lib="dom" />
import { ApexError } from "@apex14/http";

export interface WasmOptions {
  imports?: WebAssembly.Imports;
  maxMemoryPages?: number;
  timeoutMs?: number;
}

export class WasmExecutionError extends ApexError {
  constructor(message: string, code = "WASM_EXECUTION_ERROR") {
    super(500, message, code);
    this.name = "WasmExecutionError";
  }
}

export class ApexWasmInstance {
  public readonly instance: WebAssembly.Instance;
  public readonly module: WebAssembly.Module;
  public readonly exports: Record<string, any>;
  private timeoutMs: number;

  constructor(
    instance: WebAssembly.Instance,
    module: WebAssembly.Module,
    options: WasmOptions = {}
  ) {
    this.instance = instance;
    this.module = module;
    this.exports = instance.exports as Record<string, any>;
    this.timeoutMs = options.timeoutMs || 5000;
  }

  public getMemory(): WebAssembly.Memory | undefined {
    return this.exports.memory as WebAssembly.Memory | undefined;
  }

  public readString(offset: number, length?: number): string {
    const memory = this.getMemory();
    if (!memory) {
      throw new WasmExecutionError("Wasm instance does not export a 'memory' buffer");
    }
    const bytes = new Uint8Array(memory.buffer);
    let end = offset;
    if (length !== undefined) {
      end = offset + length;
    } else {
      while (end < bytes.length && bytes[end] !== 0) {
        end++;
      }
    }
    return new TextDecoder().decode(bytes.subarray(offset, end));
  }

  public writeString(offset: number, str: string): number {
    const memory = this.getMemory();
    if (!memory) {
      throw new WasmExecutionError("Wasm instance does not export a 'memory' buffer");
    }
    const encoded = new TextEncoder().encode(str);
    const bytes = new Uint8Array(memory.buffer);
    bytes.set(encoded, offset);
    // null terminator
    if (offset + encoded.length < bytes.length) {
      bytes[offset + encoded.length] = 0;
    }
    return encoded.length;
  }

  public async run<T = any>(fnName: string, ...args: any[]): Promise<T> {
    const fn = this.exports[fnName];
    if (typeof fn !== "function") {
      throw new WasmExecutionError(`Function '${fnName}' not found in WASM exports`);
    }

    if (!this.timeoutMs || this.timeoutMs <= 0) {
      try {
        return fn(...args);
      } catch (err: any) {
        throw new WasmExecutionError(`WASM execution error in '${fnName}': ${err.message}`);
      }
    }

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new WasmExecutionError(`WASM execution of '${fnName}' timed out after ${this.timeoutMs}ms`, "WASM_TIMEOUT"));
      }, this.timeoutMs);

      try {
        const result = fn(...args);
        clearTimeout(timer);
        resolve(result);
      } catch (err: any) {
        clearTimeout(timer);
        reject(new WasmExecutionError(`WASM execution error in '${fnName}': ${err.message}`));
      }
    });
  }
}

export class ApexWasmEngine {
  // Built-in standard WebAssembly module implementing add(a: i32, b: i32): i32
  public readonly sampleAddBytes = new Uint8Array([
    0x00, 0x61, 0x73, 0x6d,
    0x01, 0x00, 0x00, 0x00,
    0x01, 0x07, 0x01, 0x60, 0x02, 0x7f, 0x7f, 0x01, 0x7f,
    0x03, 0x02, 0x01, 0x00,
    0x07, 0x07, 0x01, 0x03, 0x61, 0x64, 0x64, 0x00, 0x00,
    0x0a, 0x09, 0x01, 0x07, 0x00, 0x20, 0x00, 0x20, 0x01, 0x6a, 0x0b
  ]);

  private toBufferSource(input: BufferSource | string): BufferSource {
    if (typeof input === "string") {
      // Try Base64 or Hex
      try {
        return Buffer.from(input, "base64");
      } catch {
        return Buffer.from(input, "hex");
      }
    }
    return input;
  }

  public async compile(bytesOrBuffer: BufferSource | string): Promise<WebAssembly.Module> {
    const bytes = this.toBufferSource(bytesOrBuffer);
    return await WebAssembly.compile(bytes);
  }

  public async load(
    moduleOrBytes: BufferSource | string | WebAssembly.Module,
    options: WasmOptions = {}
  ): Promise<ApexWasmInstance> {
    let wasmModule: WebAssembly.Module;
    if (moduleOrBytes instanceof WebAssembly.Module) {
      wasmModule = moduleOrBytes;
    } else {
      wasmModule = await this.compile(moduleOrBytes);
    }

    const imports: WebAssembly.Imports = options.imports || {};
    const instance = await WebAssembly.instantiate(wasmModule, imports);

    return new ApexWasmInstance(instance, wasmModule, options);
  }
}

export const wasm = new ApexWasmEngine();
