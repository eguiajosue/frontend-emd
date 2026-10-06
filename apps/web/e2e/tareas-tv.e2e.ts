import type { Page } from "@playwright/test";
import { expect, login, test } from "./helpers";

/**
 * Modo TV de "Tareas asignadas": la tele del área. José (Diseño + Bordado) ve
 * TODO Bordado, también lo de sus compañeros, en tres columnas; puede tomar y
 * terminar desde la tele, y una llegada simulada cae como paquete y queda
 * como tarjeta en "Pendiente". El guardia de CSP de `helpers` vale también
 * para la animación (framer pone `style=""`, que la política permite).
 */

const MOCK_API = "http://localhost:4010";

// La llegada es 3D (three.js): Chromium headless no tiene GPU, así que WebGL
// sale por SwiftShader. Se repite el ejecutable del proyecto porque
// `launchOptions` reemplaza entero al de playwright.config.ts.
test.use({
  launchOptions: {
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {}),
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  },
});

test.beforeEach(async ({ page, request }) => {
  await request.post(`${MOCK_API}/__e2e/reset-tareas`);
  await login(page, "jeguia1");
});

test.afterAll(async ({ request }) => {
  await request.post(`${MOCK_API}/__e2e/reset-tareas`);
});

const tele = (page: Page) => page.getByRole("dialog", { name: "Tareas del área" });
const columna = (page: Page, nombre: string) => tele(page).getByRole("region", { name: nombre, exact: true });

test("1 · el botón abre la tele con todo el área en tres columnas", async ({ page }) => {
  await page.goto("/dashboard/tareas");
  await page.getByRole("button", { name: "Modo TV" }).click();

  await expect(tele(page)).toBeVisible();
  for (const nombre of ["Pendiente", "En proceso", "Terminado"]) {
    await expect(columna(page, nombre)).toBeVisible();
  }
  // Lo libre, lo de un compañero (no sale en "mis tareas") y lo terminado reciente.
  await expect(columna(page, "Pendiente").getByRole("article", { name: /Pedido #105/ })).toBeVisible();
  await expect(columna(page, "Pendiente").getByRole("article", { name: /Pedido #106/ })).toContainText("Luis Paz");
  await expect(columna(page, "En proceso").getByRole("article", { name: /Pedido #103/ })).toContainText("Tuya");
  await expect(columna(page, "Terminado").getByRole("article", { name: /Pedido #104/ })).toBeVisible();
  // Lo de un compañero no se toma de un toque.
  await expect(
    columna(page, "Pendiente")
      .getByRole("article", { name: /Pedido #106/ })
      .getByRole("button", { name: /Tomar|Empezar|Terminar/ })
  ).toHaveCount(0);

  // Esc sale y limpia la URL.
  await page.keyboard.press("Escape");
  await expect(tele(page)).toHaveCount(0);
});

test("2 · desde la tele se toma, se empieza y se termina una tarea", async ({ page }) => {
  await page.goto("/dashboard/tareas?tv=1");
  const tarjeta = (col: string) => columna(page, col).getByRole("article", { name: /Pedido #105/ });

  await tarjeta("Pendiente").getByRole("button", { name: /Tomar y empezar/ }).click();
  await expect(tarjeta("En proceso")).toBeVisible();
  await expect(tarjeta("En proceso")).toContainText("Tuya");

  await tarjeta("En proceso").getByRole("button", { name: /Terminar/ }).click();
  await expect(tarjeta("Terminado")).toBeVisible();
  await expect(tarjeta("Terminado")).toContainText(/Terminó hace|Recién terminada/);
});

test("3 · una llegada simulada cae como paquete y queda en Pendiente", async ({ page }) => {
  await page.goto("/dashboard/tareas?tv=1&demo=1");
  await expect(columna(page, "Pendiente")).toBeVisible();

  await tele(page).getByRole("button", { name: "Simular vencido" }).click();
  const aviso = page.getByRole("status").filter({ hasText: /Nuevo pedido #9001/ });
  await expect(aviso).toBeAttached();
  // Con WebGL, la caja es 3D: un <canvas> de three sobre el tablero.
  await expect(aviso).toHaveAttribute("data-arrival-mode", "3d");
  await expect(aviso.locator("[data-arrival-canvas] canvas")).toBeAttached({ timeout: 5_000 });

  // Al terminar la animación (~4 s) queda la tarjeta en su columna y el paquete se va.
  const nueva = columna(page, "Pendiente").getByRole("article", { name: /Pedido #9001/ });
  await expect(nueva).toBeVisible({ timeout: 10_000 });
  await expect(aviso).toHaveCount(0, { timeout: 10_000 });
  // Vencida: va primero (urgencia) y con el semáforo rojo.
  await expect(nueva).toContainText("Vencido");

  // Varias juntas: una sola caja grande "N pedidos nuevos".
  await tele(page).getByRole("button", { name: "Simular 5 pedidos" }).click();
  await expect(page.getByRole("status").filter({ hasText: "5 pedidos nuevos" })).toBeAttached();
  await expect(columna(page, "Pendiente").getByRole("article", { name: /Pedido #9006/ })).toBeVisible({ timeout: 12_000 });
});

test("4 · la paleta ⌘K abre el Modo TV de tareas", async ({ page }) => {
  await page.goto("/dashboard/tareas");
  await page.keyboard.press("Control+k");
  await page.getByRole("option", { name: /Modo TV de tareas/ }).click();
  await expect(tele(page)).toBeVisible();
  await expect(page).toHaveURL(/tv=1/);
});

test("5 · tocar una tarjeta abre el detalle del pedido encima de la tele", async ({ page }) => {
  await page.goto("/dashboard/tareas?tv=1");
  const tarjeta = columna(page, "Pendiente").getByRole("article", { name: /Pedido #105/ });

  // Con el mouse, en cualquier parte de la tarjeta (aquí, sobre la descripción).
  await tarjeta.getByText("Mandiles con logo").click();
  const detalle = page.getByRole("dialog", { name: /#105/ });
  await expect(detalle).toBeVisible();
  await expect(detalle).toContainText("Café Central");
  // Queda arriba de la pantalla completa: lo que se ve en su centro es el detalle.
  const caja = await detalle.boundingBox();
  expect(caja).not.toBeNull();
  const arriba = await page.evaluate(
    ({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest('[role="dialog"]:not([data-state="closed"])')?.textContent?.includes("#105")),
    { x: caja!.x + caja!.width / 2, y: caja!.y + Math.min(caja!.height / 2, 120) }
  );
  expect(arriba).toBe(true);

  // Esc cierra sólo el detalle: la tele sigue abierta y el foco vuelve a la tarjeta.
  await page.keyboard.press("Escape");
  await expect(detalle).toHaveCount(0);
  await expect(tele(page)).toBeVisible();
  await expect(tarjeta.getByRole("button", { name: "Ver detalle del pedido #105" })).toBeFocused();

  // Con el teclado: Enter sobre el botón de la tarjeta.
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: /#105/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(tele(page)).toBeVisible();

  // El botón de acción no abre el detalle: hace lo suyo.
  await tarjeta.getByRole("button", { name: /Tomar y empezar/ }).click();
  await expect(columna(page, "En proceso").getByRole("article", { name: /Pedido #105/ })).toBeVisible();
  await expect(page.getByRole("dialog", { name: /#105/ })).toHaveCount(0);
});

test("6 · con prefers-reduced-motion la llegada es la versión 2D (sin WebGL)", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/dashboard/tareas?tv=1&demo=1");
  await expect(columna(page, "Pendiente")).toBeVisible();

  await tele(page).getByRole("button", { name: "Simular a tiempo" }).click();
  const aviso = page.getByRole("status").filter({ hasText: /Nuevo pedido #9001/ });
  await expect(aviso).toHaveAttribute("data-arrival-mode", "2d");
  await expect(aviso.locator("canvas")).toHaveCount(0);
  await expect(columna(page, "Pendiente").getByRole("article", { name: /Pedido #9001/ })).toBeVisible({ timeout: 10_000 });
  await expect(aviso).toHaveCount(0, { timeout: 10_000 });
});
