import { expect, test, login } from "./helpers";

/**
 * Inventario por área: el usuario de Bordado sólo ve lo suyo, avisa que se
 * acabó un insumo y registra un consumo; Recepción ve el aviso en
 * "Solicitudes de reabasto" (con badge), lo mueve a "En camino" y la
 * bitácora; Bordado ve el nuevo estado.
 */

const API = `http://localhost:${process.env.MOCK_API_PORT ?? 4010}`;

test.beforeEach(async () => {
  await fetch(`${API}/__e2e/reset-inventory`, { method: "POST" });
});

test("el área ve sólo lo suyo, avisa reabasto y Recepción lo atiende", async ({ page, browser }) => {
  await login(page, "bordado");
  await page.goto("/dashboard/inventario");
  await expect(page.getByText("Hilo poliéster rojo 1147").first()).toBeVisible({ timeout: 30_000 });
  // Nada de otra área ni de gestión.
  await expect(page.getByText("Tinta cyan para plotter")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Nuevo artículo/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Exportar CSV/ })).toHaveCount(0);

  // Consumo (resta) con motivo.
  await page.getByRole("button", { name: "Registrar consumo de Hilo poliéster rojo 1147" }).first().click();
  await page.getByLabel(/Cantidad que sale/).fill("2");
  await page.getByLabel("Motivo").fill("Pedido de gorras");
  await page.getByRole("button", { name: "Registrar", exact: true }).click();
  await expect(page.getByText("Consumo registrada")).toBeVisible();

  // Avisar reabasto del estabilizador agotado.
  await page.getByRole("button", { name: "Avisar reabasto de Estabilizador cut-away 45 cm" }).first().click();
  await page.getByLabel("Comentario").fill("Se acabó el rollo");
  await page.getByRole("button", { name: "Enviar aviso" }).click();
  await expect(page.getByText("Aviso enviado a Recepción")).toBeVisible();

  // Recepción (otro contexto) ve la solicitud con el badge y la mueve.
  const ctx = await browser.newContext();
  const recepcion = await ctx.newPage();
  await login(recepcion, "recepcion1");
  await recepcion.goto("/dashboard/inventario");
  const tab = recepcion.getByRole("tab", { name: /Solicitudes de reabasto/ });
  await expect(tab).toBeVisible({ timeout: 30_000 });
  await expect(tab.getByLabel("1 pendientes")).toBeVisible();
  await tab.click();
  const fila = recepcion.getByTestId("restock-row").first();
  await expect(fila).toContainText("Estabilizador cut-away 45 cm");
  await expect(fila).toContainText("Urgente");
  await expect(fila).toContainText("Se acabó el rollo");
  await fila.getByRole("button", { name: "Marcar en camino" }).click();
  await expect(fila).toContainText("En camino");

  // Bitácora: el consumo con quién y antes → después.
  await recepcion.getByRole("tab", { name: "Bitácora" }).click();
  await expect(recepcion.getByText("Pedido de gorras")).toBeVisible();
  await expect(recepcion.getByText(/Bordado/).first()).toBeVisible();
  await ctx.close();

  // El área ve el estado nuevo de su aviso.
  await page.getByRole("tab", { name: /Mis avisos de reabasto/ }).click();
  await expect(page.getByTestId("restock-row").first()).toContainText("En camino");
});
