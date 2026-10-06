import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Dos tipos de test, dos entornos.
 *
 * `src/**` en `.test.ts` son helpers puros y corren en node. Los `.test.tsx`
 * renderizan componentes de verdad con Testing Library y necesitan jsdom;
 * `environmentMatchGlobs` los manda ahí sin partir la suite en dos comandos.
 *
 * JSX vía esbuild en vez de `@vitejs/plugin-react`: la versión del plugin que
 * pide vite 8 no convive con el vite 5 que trae este vitest, y para tests de
 * componentes el transform de esbuild alcanza (no hace falta Fast Refresh).
 */
export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "node",
    environmentMatchGlobs: [["**/*.test.tsx", "jsdom"]],
    setupFiles: ["./vitest.setup.ts"],
  },
});
