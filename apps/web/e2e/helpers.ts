import { expect, type Page } from "@playwright/test";

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
  await page.getByRole("button", { name: "Cuadrícula" }).click();
}
