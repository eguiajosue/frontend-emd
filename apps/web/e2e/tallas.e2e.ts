import { expect, test, login } from "./helpers";

/**
 * Tallas por prenda: alta de pedido con desglose, detalle en sólo lectura y
 * tabla de tallas en la lámina del mockup.
 */

const MOCK_API = `http://localhost:${process.env.MOCK_API_PORT ?? 4010}`;

test.use({
  launchOptions: {
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {}),
    args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
  },
});

const PNG_1X1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

test("1 · el detalle del pedido muestra el resumen de tallas", async ({ page }) => {
  await login(page);
  await page.goto("/dashboard/orders");
  await page.getByRole("button", { name: /Ver detalle del pedido #101/ }).click();
  const resumen = page.getByTestId("size-summary");
  await expect(resumen).toContainText("General: 10 M · 14 L");
  await expect(resumen).toContainText("24 pzas");
});

test("2 · crear un pedido con desglose de tallas", async ({ page, request }) => {
  await login(page);
  await page.goto("/dashboard/orders?new=1");
  const dialogo = page.getByRole("dialog", { name: "Nuevo pedido" });
  await expect(dialogo).toBeVisible({ timeout: 30_000 });

  await dialogo.getByRole("combobox", { name: "Cliente" }).click();
  await page.getByPlaceholder("Buscar cliente…").fill("Cliente de prueba");
  await page.getByText('Usar "Cliente de prueba" como nombre de cliente').click();
  await dialogo.getByRole("radio", { name: "Sin diseño" }).click();
  await dialogo
    .getByRole("group", { name: /^Áreas de producción/ })
    .getByRole("button", { name: /Taller/ })
    .click();
  await dialogo.getByRole("combobox", { name: "Agregar producto" }).click();
  await page.getByPlaceholder("+ Agregar producto…").fill("Playera");
  await page.getByText('Usar "Playera" como producto nuevo').click();
  await dialogo.getByLabel("Descripción").fill("Playeras con tallas");

  await dialogo.getByRole("button", { name: "Tallas" }).click();
  await dialogo.getByLabel(/^General S/).fill("5");
  await dialogo.getByLabel(/^General M/).fill("2");
  await dialogo.getByLabel(/^General L/).fill("3");
  await expect(dialogo.getByText("Total: 10 pzas")).toBeVisible();
  await expect(dialogo.getByLabel("Cantidad de Playera")).toHaveValue("10");

  await dialogo.getByRole("button", { name: /Crear pedido/ }).click();
  await expect
    .poll(async () => ((await (await request.get(`${MOCK_API}/__e2e/orders`)).json()) as unknown[]).length)
    .toBeGreaterThan(0);
  const [orden] = (await (await request.get(`${MOCK_API}/__e2e/orders`)).json()) as Array<{
    orderProducts: Array<{ customName: string; quantity: number; sizes: unknown }>;
  }>;
  expect(orden.orderProducts).toEqual([
    { customName: "Playera", quantity: 10, sizes: { general: { S: 5, M: 2, L: 3 } } },
  ]);
});

test("3 · la lámina del mockup imprime la tabla de tallas", async ({ page, request }) => {
  test.setTimeout(180_000);
  await login(page);
  await expect(page).toHaveURL(/\/dashboard\/inicio/, { timeout: 30_000 });
  await page
    .getByRole("complementary", { name: "Navegación principal" })
    .getByRole("link", { name: "Mockups", exact: true })
    .click();
  const lienzo = page.getByRole("img", { name: "Vista 3D de la prenda con los diseños" });
  await expect(lienzo).toBeVisible({ timeout: 30_000 });
  await expect(lienzo.getByText("Cargando prenda…")).toHaveCount(0, { timeout: 30_000 });

  await page.getByLabel("Subir diseño").setInputFiles({
    name: "logo.png",
    mimeType: "image/png",
    buffer: Buffer.from(PNG_1X1, "base64"),
  });

  const panel = page.getByRole("region", { name: "Tallas" });
  const generalM = panel.locator("#mockup-sizes-general-M");
  await generalM.fill("5");
  await expect(generalM).toHaveValue("5");
  await panel.getByRole("button", { name: /Mujer \(dama\)/ }).click();
  // Por id y no por etiqueta: así la casilla es siempre la talla S de Mujer.
  const mujerS = panel.locator("#mockup-sizes-mujer-S");
  await expect(mujerS).toBeVisible();
  await mujerS.fill("3");
  await expect(mujerS).toHaveValue("3");
  await expect(panel.getByText("Total: 8 pzas")).toBeVisible();

  await page.getByRole("button", { name: "Adjuntar a pedido" }).click();
  const dialogo = page.getByRole("dialog", { name: "Adjuntar a pedido" });
  await expect(dialogo).toBeVisible({ timeout: 60_000 });
  await dialogo
    .getByRole("list", { name: "Pedidos" })
    .getByRole("button", { name: /#101.*Colegio San Marcos/ })
    .click();
  await expect(page.getByText("Mockup adjuntado al pedido #101")).toBeVisible({ timeout: 30_000 });

  const recibidos = (await (await request.get(`${MOCK_API}/__e2e/mockups`)).json()) as Array<{
    imageDataUrl: string;
    config: { sizes: unknown };
  }>;
  const ultimo = recibidos[recibidos.length - 1];
  expect(ultimo.config.sizes).toEqual({ general: { M: 5 }, mujer: { S: 3 } });
  // La lámina sin tallas mide 800 de alto; con la tabla crece hacia abajo.
  const png = Buffer.from(ultimo.imageDataUrl.split(",")[1], "base64");
  expect(png.readUInt32BE(20)).toBeGreaterThan(800);
});
