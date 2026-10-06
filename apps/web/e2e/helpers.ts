import { expect, test as base, type Page } from "@playwright/test";

export { expect };

/**
 * `test` de Playwright con un guardia de CSP automático: si el navegador
 * reporta una violación de la Content-Security-Policy (script sin nonce, un
 * `eval`, un fetch a un host no permitido…) el test falla aunque la pantalla
 * "funcione". Todas las specs lo importan de aquí en vez de @playwright/test.
 */
export const test = base.extend<{ cspGuard: void }>({
  cspGuard: [
    async ({ page }, use) => {
      const violations: string[] = [];
      page.on("console", (message) => {
        if (/Content Security Policy/i.test(message.text())) violations.push(message.text());
      });
      await use();
      expect(violations, "violaciones de CSP en la consola").toEqual([]);
    },
    { auto: true },
  ],
});

/**
 * Entra como Recepción (o como `username`, con los roles que le da el backend
 * de mentira). El login pega contra ese backend, así que cualquier contraseña
 * sirve: lo que se prueba aquí no es la autenticación sino lo que pasa después
 * de entrar.
 */
export async function login(page: Page, username = "recepcion1") {
  await page.goto("/login");
  await page.locator("#username").fill(username);
  await page.locator("#password").fill("lo-que-sea");
  await page.getByRole("button", { name: "Iniciar Sesión" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
}

/** Abre la pantalla de pedidos en modo cuadrícula (el tablero kanban). */
export async function abrirTablero(page: Page) {
  await page.goto("/dashboard/orders");
  // Lista / Cuadrícula es un selector de una opción (radiogroup "Vista").
  await page.getByRole("radiogroup", { name: "Vista" }).getByRole("radio", { name: "Cuadrícula" }).click();
}
