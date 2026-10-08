import type { Page } from "@playwright/test";
import { expect, login, test } from "./helpers";

/**
 * Bordado no entra directo a producción: se digitaliza, se prueba y luego se
 * borda. Su tablero (Tareas asignadas y Modo TV) lleva esas etapas como
 * columnas: Digitalizado → En pruebas → En producción → Terminado, y cada
 * tarjeta trae el botón de su siguiente paso.
 */

const MOCK_API = "http://localhost:4010";

test.use({
  launchOptions: {
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {}),
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  },
});

test.beforeEach(async ({ page, request }) => {
  await request.post(`${MOCK_API}/__e2e/reset-tareas`);
  await request.post(`${MOCK_API}/__e2e/seed-bordado-prep`);
  await login(page, "bordado");
});

test.afterAll(async ({ request }) => {
  await request.post(`${MOCK_API}/__e2e/reset-tareas`);
});

const columna = (page: Page, nombre: string) => page.getByRole("region", { name: new RegExp(`^${nombre}`) });
const tarjeta = (page: Page, pedido: number) => page.getByRole("article").filter({ hasText: `#${pedido}` });

test("1 · Tareas asignadas: cuatro columnas y cada tarjeta en su etapa", async ({ page }) => {
  await page.goto("/dashboard/tareas");
  for (const nombre of ["Digitalizado", "En pruebas", "En producción", "Terminado"]) {
    await expect(columna(page, nombre)).toBeVisible();
  }
  await expect(columna(page, "Digitalizado").getByRole("article").filter({ hasText: "#107" })).toBeVisible();
  await expect(columna(page, "Digitalizado").getByRole("article").filter({ hasText: "#109" })).toBeVisible();
  await expect(columna(page, "En pruebas").getByRole("article").filter({ hasText: "#108" })).toBeVisible();
  await expect(columna(page, "En producción").getByRole("article").filter({ hasText: "#105" })).toBeVisible();
  await expect(columna(page, "Terminado").getByRole("article").filter({ hasText: "#104" })).toBeVisible();

  // La prueba rechazada dice qué corregir, y va primero.
  const rechazada = tarjeta(page, 107);
  await expect(rechazada.getByRole("note")).toContainText("El hilo se frunce en el contorno");
  await expect(columna(page, "Digitalizado").getByRole("article").first()).toContainText("#107");
  // Nada que no produce ofrece "Empezar".
  await expect(columna(page, "Digitalizado").getByRole("button", { name: /Empezar/ })).toHaveCount(0);
  await expect(columna(page, "En pruebas").getByRole("button", { name: /Empezar/ })).toHaveCount(0);
});

test("2 · el flujo completo: mandar a pruebas, aprobar, rechazar y empezar", async ({ page }) => {
  await page.goto("/dashboard/tareas");

  // Digitalizado → En pruebas (con notas).
  await tarjeta(page, 109).getByRole("button", { name: "Mandar a pruebas" }).click();
  await page.getByLabel("Observaciones").fill("Puntada satín, 7 cm");
  await page.getByRole("dialog").getByRole("button", { name: "Mandar a pruebas" }).click();
  await expect(columna(page, "En pruebas").getByRole("article").filter({ hasText: "#109" })).toBeVisible();
  await expect(columna(page, "Digitalizado").getByRole("article").filter({ hasText: "#109" })).toHaveCount(0);

  // En pruebas → En producción (aprobada).
  await tarjeta(page, 108).getByRole("button", { name: "Aprobar" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Aprobar prueba" }).click();
  await expect(columna(page, "En producción").getByRole("article").filter({ hasText: "#108" })).toBeVisible();

  // Rechazar pide el motivo y devuelve la tarjeta a Digitalizado con el aviso.
  await tarjeta(page, 109).getByRole("button", { name: "Rechazar" }).click();
  const confirmar = page.getByRole("dialog").getByRole("button", { name: "Rechazar prueba" });
  await expect(confirmar).toBeDisabled();
  await page.getByLabel("Observaciones").fill("Se ve corrida");
  await confirmar.click();
  const vuelta = columna(page, "Digitalizado").getByRole("article").filter({ hasText: "#109" });
  await expect(vuelta).toBeVisible();
  await expect(vuelta.getByRole("note")).toContainText("Se ve corrida");

  // Ya en producción sí se empieza.
  await tarjeta(page, 108).getByRole("button", { name: /empezar/i }).click();
  await expect(tarjeta(page, 108).getByRole("button", { name: "Terminar" })).toBeVisible();
});

test("3 · Modo TV: las mismas cuatro columnas y los botones de etapa", async ({ page }) => {
  await page.goto("/dashboard/tareas");
  await page.getByRole("button", { name: "Modo TV" }).click();
  const tele = page.getByRole("dialog", { name: "Tareas del área" });
  await expect(tele).toBeVisible();
  const col = (nombre: string) => tele.getByRole("region", { name: nombre, exact: true });
  for (const nombre of ["Digitalizado", "En pruebas", "En producción", "Terminado"]) {
    await expect(col(nombre)).toBeVisible();
  }
  await expect(col("Digitalizado").getByRole("article", { name: /Pedido #107/ })).toContainText("El hilo se frunce");
  await expect(col("En pruebas").getByRole("article", { name: /Pedido #108/ })).toBeVisible();
  await expect(col("En producción").getByRole("article", { name: /Pedido #105/ })).toBeVisible();

  await col("En pruebas").getByRole("button", { name: "Aprobar" }).click();
  await page.getByRole("dialog", { name: "Aprobar la prueba" }).getByRole("button", { name: "Aprobar prueba" }).click();
  await expect(col("En producción").getByRole("article", { name: /Pedido #108/ })).toBeVisible({ timeout: 15_000 });
});
