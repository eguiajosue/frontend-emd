import { expect, type Page } from "@playwright/test";

/**
 * Entra como Recepción. El login pega contra el backend de mentira, así que
 * cualquier contraseña sirve: lo que se prueba acá no es la autenticación sino
 * lo que pasa después de entrar.
 */
export async function login(page: Page) {
  await page.goto("/login");
  await page.locator("#username").fill("recepcion1");
  await page.locator("#password").fill("lo-que-sea");
  await page.getByRole("button", { name: "Iniciar Sesión" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
}

/** Abre la pantalla de pedidos en modo cuadrícula (el tablero kanban). */
export async function abrirTablero(page: Page) {
  await page.goto("/dashboard/orders");
  await page.getByRole("button", { name: "Cuadrícula" }).click();
}
