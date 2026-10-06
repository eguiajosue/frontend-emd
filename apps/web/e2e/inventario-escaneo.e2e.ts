import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";

/**
 * Modo Escanear de Inventario con un lector USB "modo teclado" simulado:
 * Playwright teclea el código muy rápido (como el lector) y Enter, sin foco
 * en ningún campo. Después se verifica el stock en el backend de mentira.
 */

const API = "http://localhost:4010";

async function stock(id: number): Promise<{ quantity: number; barcode: string }> {
  const res = await fetch(`${API}/inventory`);
  const items = (await res.json()) as { id: number; quantity: number; barcode: string }[];
  return items.find((i) => i.id === id)!;
}

/** Lo que manda un lector: ráfaga de teclas (5 ms entre una y otra) + Enter. */
async function escanear(page: Page, code: string) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.type(code, { delay: 5 });
  await page.keyboard.press("Enter");
}

test.beforeEach(async ({ page }) => {
  await fetch(`${API}/__e2e/reset-inventory`, { method: "POST" });
  await login(page);
  await page.goto("/dashboard/inventario");
  await expect(page.getByText("Hilo poliéster rojo 1147").first()).toBeVisible({ timeout: 30_000 });
});

test("escanear: entrada, salida y código desconocido ligado a un artículo", async ({ page }) => {
  await page.getByRole("button", { name: "Escanear" }).click();
  const tipo = page.getByRole("radiogroup", { name: "Tipo de movimiento" });
  await expect(tipo.getByRole("radio", { name: /Entrada/ })).toHaveAttribute("aria-checked", "true");

  // Entrada: +1.
  await escanear(page, "EMD-000001");
  const registro = page.getByRole("list", { name: "Registro de escaneos" });
  const primera = registro.getByTestId("scan-log-entry").first();
  await expect(primera).toContainText("+1");
  await expect(primera).toContainText("Hilo poliéster rojo 1147");
  await expect(primera).toContainText("Quedan 13 cono");
  expect((await stock(1)).quantity).toBe(13);

  // Salida: −1 (pasado el filtro de duplicados de 800 ms).
  await tipo.getByRole("radio", { name: /Salida/ }).click();
  await page.waitForTimeout(900);
  await escanear(page, "EMD-000001");
  await expect(registro.getByTestId("scan-log-entry")).toHaveCount(2);
  await expect(registro.getByTestId("scan-log-entry").first()).toContainText("−1");
  await expect(registro.getByTestId("scan-log-entry").first()).toContainText("Quedan 12 cono");
  expect((await stock(1)).quantity).toBe(12);

  // Deshacer la salida: vuelve a 13.
  await registro.getByRole("button", { name: "Deshacer −1 de Hilo poliéster rojo 1147" }).click();
  await expect(registro.getByTestId("scan-log-entry").first()).toContainText("Deshecho");
  await expect.poll(async () => (await stock(1)).quantity).toBe(13);

  // Salida sin stock: aviso claro.
  await escanear(page, "7501234567890");
  await expect(page.getByTestId("scan-last")).toContainText("Stock insuficiente: hay 0 rollo");

  // Código que nadie tiene → ligarlo a la tinta y registrar la salida pendiente.
  await escanear(page, "TINTA-CY-01");
  const dialogo = page.getByRole("dialog", { name: "Código sin artículo" });
  await expect(dialogo).toBeVisible();
  await dialogo.getByLabel("Buscar artículo para ligar").fill("tinta");
  await dialogo.getByRole("button", { name: /Tinta cyan para plotter/ }).click();
  await dialogo.getByRole("button", { name: "Ligar y registrar salida de 1" }).click();
  await expect(dialogo).toBeHidden();
  await expect(registro.getByTestId("scan-log-entry").first()).toContainText("Tinta cyan para plotter");
  const tinta = await stock(2);
  expect(tinta.barcode).toBe("TINTA-CY-01");
  expect(tinta.quantity).toBe(2);
});

test("tecleo humano en un campo no cuenta como escaneo", async ({ page }) => {
  await page.getByRole("button", { name: "Escanear" }).click();
  await page.getByLabel("Cantidad por escaneo").click();
  await page.keyboard.type("123", { delay: 120 });
  await page.keyboard.press("Enter");
  await expect(page.getByText("Aquí aparece cada escaneo")).toBeVisible();
  expect((await stock(1)).quantity).toBe(12);
});

test("etiquetas: vista previa del lote y documento de impresión de 80 × 35 mm", async ({ page }) => {
  const tabla = page.locator("table").first();
  await tabla.getByRole("checkbox", { name: "Seleccionar Hilo poliéster rojo 1147" }).click();
  await tabla.getByRole("checkbox", { name: "Seleccionar Estabilizador cut-away 45 cm" }).click();
  await page.getByRole("region", { name: "Selección para etiquetas" }).getByRole("button", { name: /Imprimir etiquetas/ }).click();

  const dialogo = page.getByRole("dialog", { name: "Imprimir 2 etiquetas" });
  await expect(dialogo.getByTestId("label-preview")).toHaveCount(2);
  await expect(dialogo.getByTestId("label-preview").first()).toContainText("EMD-000001");
  await expect(dialogo.getByTestId("label-preview").nth(1)).toContainText("7501234567890");

  // window.print no abre nada en headless; se revisa el documento que recibe.
  await page.evaluate(() => {
    window.print = () => undefined;
  });
  await dialogo.getByRole("button", { name: "Una copia más" }).click();
  await dialogo.getByRole("button", { name: "Imprimir" }).click();
  const srcdoc = await page.locator("#emd-label-print-frame").getAttribute("srcdoc");
  expect(srcdoc).toContain("@page{size:80mm 35mm;margin:0}");
  expect(srcdoc?.match(/class="page"/g)).toHaveLength(4);
});
