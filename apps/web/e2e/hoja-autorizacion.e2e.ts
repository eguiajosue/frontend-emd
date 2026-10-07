import type { Page } from "@playwright/test";
import { expect, login, test } from "./helpers";

/**
 * Hoja de autorización en el detalle del pedido: al abrir un pedido desde
 * "Tareas asignadas", Producción ve arriba el montaje que autorizó el cliente
 * (imágenes con zoom o PDF para abrir/descargar). Si todavía no hay ronda
 * autorizada, se muestra la última enviada marcada como "Sin autorizar".
 * Todo bajo la CSP real (el guardia de `helpers` falla ante cualquier violación).
 */

const MOCK_API = "http://localhost:4010";

test.beforeEach(async ({ request }) => {
  await request.post(`${MOCK_API}/__e2e/reset-tareas`);
});

const hoja = (page: Page) =>
  page.getByRole("dialog").getByRole("region", { name: "Hoja de autorización" });

/** Las imágenes cargaron de verdad (data URL decodificada, no un ícono roto). */
async function imagenesCargadas(page: Page, nombres: string[]) {
  for (const nombre of nombres) {
    const img = hoja(page).getByRole("img", { name: nombre });
    await expect(img).toBeVisible();
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  }
}

test("1 · Bordado abre su tarea y ve la hoja autorizada, con zoom", async ({ page }) => {
  await login(page, "bordado");
  await page.goto("/dashboard/tareas");
  await page.getByRole("button", { name: "Ver pedido #101 de Colegio San Marcos" }).click();

  await expect(hoja(page)).toBeVisible();
  await expect(hoja(page)).toContainText("Autorizada");
  await expect(hoja(page)).toContainText("Ronda 2 · autorizada por el cliente");
  // La ronda 1 (con cambios) no es la hoja: sólo las dos imágenes de la 2.
  await imagenesCargadas(page, ["hoja-frente.png", "hoja-espalda.png"]);
  await expect(hoja(page).getByRole("img", { name: "ronda1-frente.png" })).toHaveCount(0);
  await expect(hoja(page).getByRole("button", { name: "Descargar hoja-frente.png" })).toBeVisible();

  await hoja(page).getByRole("button", { name: "Ampliar hoja-espalda.png" }).click();
  const cerrar = page.getByRole("button", { name: "Cerrar imagen" });
  await expect(cerrar).toBeVisible();
  await cerrar.click();
  await expect(cerrar).toHaveCount(0);
  // El detalle sigue abierto.
  await expect(hoja(page)).toBeVisible();
});

test("2 · hoja en PDF: se abre y se descarga", async ({ page }) => {
  await login(page, "jeguia1");
  await page.goto("/dashboard/tareas");
  await page.getByRole("button", { name: "Ver pedido #103 de Club Deportivo Norte" }).first().click();

  await expect(hoja(page)).toContainText("Autorizada");
  await expect(hoja(page)).toContainText("hoja-gorras.pdf");
  // Se abre en una pestaña nueva como blob URL (la CSP no deja incrustarlo).
  // Se mira la URL que pide la app y no la de la pestaña: el Chromium headless
  // reciente no trae visor de PDF y esa pestaña nunca confirma la navegación
  // (su URL queda en ""), aunque en un navegador de verdad el PDF abre.
  await page.evaluate(() => {
    const w = window as typeof window & { __abiertas?: string[] };
    w.__abiertas = [];
    const open = window.open.bind(window);
    window.open = (url, ...rest) => {
      w.__abiertas!.push(String(url));
      return open(url, ...rest);
    };
  });
  const pestana = page.waitForEvent("popup");
  await hoja(page).getByRole("button", { name: "Abrir hoja-gorras.pdf" }).click();
  await pestana;
  const abiertas = await page.evaluate(() => (window as typeof window & { __abiertas?: string[] }).__abiertas);
  expect(abiertas).toEqual([expect.stringMatching(/^blob:/)]);

  const descarga = page.waitForEvent("download");
  await hoja(page).getByRole("button", { name: "Descargar hoja-gorras.pdf" }).click();
  expect((await descarga).suggestedFilename()).toBe("hoja-gorras.pdf");
});

test("3 · sin ronda autorizada: la última enviada, marcada como tal", async ({ page }) => {
  await login(page, "jeguia1");
  await page.goto("/dashboard/tareas");
  await page.getByRole("button", { name: "Ver pedido #105 de Café Central" }).first().click();

  await expect(hoja(page)).toContainText("Sin autorizar");
  await expect(hoja(page)).toContainText("Ronda 1 · esperando autorización del cliente");
  await expect(hoja(page).getByRole("note")).toContainText("no se produce con ella");
  await imagenesCargadas(page, ["mandil-propuesta.png"]);
});
