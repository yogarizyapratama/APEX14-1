import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@apex14/router": path.resolve(__dirname, "packages/router/src/index.ts"),
      "@apex14/http": path.resolve(__dirname, "packages/http/src/index.ts"),
      "@apex14/core": path.resolve(__dirname, "packages/core/src/index.ts"),
      "@apex14/validation": path.resolve(__dirname, "packages/validation/src/index.ts"),
      "@apex14/security": path.resolve(__dirname, "packages/security/src/index.ts"),
      "@apex14/storage": path.resolve(__dirname, "packages/storage/src/index.ts"),
      "@apex14/database": path.resolve(__dirname, "packages/database/src/index.ts"),
      "@apex14/runtime-node": path.resolve(__dirname, "packages/runtime-node/src/index.ts"),
      "@apex14/runtime-bun": path.resolve(__dirname, "packages/runtime-bun/src/index.ts"),
      "apex14": path.resolve(__dirname, "packages/apex14/src/index.ts")
    }
  },
  test: {
    globals: true,
    environment: "node",
    include: ["packages/**/*.test.ts", "tests/**/*.test.ts"],
    testTimeout: 10000
  }
});
