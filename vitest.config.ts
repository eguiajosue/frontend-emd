import path from "node:path";
import { defineConfig } from "vitest/config";

/** Tests unitarios de helpers puros (`src/lib/**`), con el alias `@/` del proyecto. */
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
