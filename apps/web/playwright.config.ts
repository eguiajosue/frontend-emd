import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end contra la app real, con un backend de mentira (`e2e/mock-api.mjs`).
 *
 * Los dos servidores los levanta Playwright: el mock primero, después Next
 * apuntado a él. No hace falta red ni el backend de producción, así que la
 * suite corre igual en CI y en una máquina sin acceso a Render.
 *
 * El navegador: normalmente el que instala `npx playwright install`. En un
 * entorno sin salida a internet que ya trae un Chromium (el caso de los
 * contenedores de CI de este proyecto), `PLAYWRIGHT_CHROMIUM_PATH` lo apunta a
 * ese binario y no hace falta descargar nada.
 */
const PORT = 3100;
const MOCK_API_PORT = 4010;

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.e2e\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(process.env.PLAYWRIGHT_CHROMIUM_PATH
          ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } }
          : {}),
      },
    },
  ],
  webServer: [
    {
      command: `node e2e/mock-api.mjs`,
      port: MOCK_API_PORT,
      reuseExistingServer: !process.env.CI,
      env: { MOCK_API_PORT: String(MOCK_API_PORT) },
    },
    {
      // Build de producción, no `next dev`: el overlay de desarrollo de Next
      // monta un portal que se come los clicks sobre los controles de la
      // esquina, y además así se prueba lo que se despliega de verdad.
      command: `npx next build && npx next start --port ${PORT}`,
      port: PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
      env: {
        NEXT_PUBLIC_BACKEND_URL: `http://localhost:${MOCK_API_PORT}`,
        NEXTAUTH_SECRET: "secreto-solo-para-tests",
        NEXTAUTH_URL: `http://localhost:${PORT}`,
      },
    },
  ],
});
