import { expect, test, login } from "./helpers";

/**
 * "Nuevo pedido" para quien carga pedidos todo el día: todo con el teclado,
 * sin tocar el mouse. N abre el panel, el cliente se busca y se elige con
 * Enter, los productos se agregan con la cantidad al frente ("50 playera"),
 * Enter vacío pasa a la descripción y Ctrl+Enter crea. Se verifica el cuerpo
 * del POST /orders que recibió el backend de mentira.
 */

const MOCK_API = `http://localhost:${process.env.MOCK_API_PORT ?? 4010}`;

type Creado = {
  clientId?: number;
  clientNameOverride?: string;
  requiresDesign: boolean;
  area?: string;
  productionArea?: string;
  productionAreas?: string[];
  statusId: number;
  userId: number;
  description: string;
  deliveryDate?: string;
  orderProducts: Array<{ customName: string; quantity: number }>;
};

// Los specs que leen `/__e2e/orders` (tallas) toman el primero: no dejar pedidos de más.
test.afterEach(async ({ request }) => {
  await request.post(`${MOCK_API}/__e2e/reset-orders`);
});

test("flujo experto sólo con teclado: N → cliente → productos → descripción → Ctrl+Enter", async ({ page, request }) => {
  const descripcion = `Logo bordado al frente ${Date.now()}`;
  await login(page);
  await page.goto("/dashboard/orders");
  // La ruta de siempre de este equipo, que el navegador recuerda del último pedido.
  await page.evaluate(() =>
    window.localStorage.setItem("emd:lastOrderDefaults", JSON.stringify({ requiresDesign: false, area: "taller" }))
  );
  await expect(page.getByRole("button", { name: /Nuevo Pedido/ })).toBeVisible({ timeout: 30_000 });

  await page.keyboard.press("n");
  const dialog = page.getByRole("dialog", { name: "Nuevo pedido" });
  await expect(dialog).toBeVisible();

  // Cliente: escribir y Enter (la primera coincidencia queda activa).
  const cliente = dialog.getByRole("combobox", { name: "Cliente" });
  await expect(cliente).toBeFocused();
  await page.keyboard.type("colegio");
  await expect(page.getByRole("option", { name: "Colegio San Marcos" })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  await expect(dialog.getByTestId("order-client-name")).toHaveText("Colegio San Marcos");

  // Productos con la cantidad al frente; el foco se queda para la siguiente línea.
  const agregar = dialog.getByRole("combobox", { name: "Agregar producto" });
  await expect(agregar).toBeFocused();
  await page.keyboard.type("50 playera");
  await page.keyboard.press("Enter");
  await expect(dialog.getByLabel("Cantidad de Playera")).toHaveValue("50");
  await expect(agregar).toBeFocused();
  await page.keyboard.type("12 gorra");
  await page.keyboard.press("Enter");
  await expect(dialog.getByLabel("Cantidad de Gorra")).toHaveValue("12");

  // Enter vacío: a la descripción.
  await page.keyboard.press("Enter");
  await expect(dialog.getByLabel("Descripción")).toBeFocused();
  await page.keyboard.type(descripcion);

  await expect(dialog.getByTestId("order-summary")).toContainText("Colegio San Marcos · Directo a Taller · 2 productos, 62 u.");
  await page.keyboard.press("Control+Enter");

  await expect
    .poll(async () => {
      const recibidos = (await (await request.get(`${MOCK_API}/__e2e/orders`)).json()) as Creado[];
      return recibidos.find((o) => o.description === descripcion) ?? null;
    })
    .not.toBeNull();
  const recibidos = (await (await request.get(`${MOCK_API}/__e2e/orders`)).json()) as Creado[];
  const creado = recibidos.find((o) => o.description === descripcion)!;
  expect(creado).toMatchObject({
    clientId: 1,
    requiresDesign: false,
    area: "taller",
    productionAreas: ["taller"],
    statusId: 1,
    userId: 1,
    orderProducts: [
      { customName: "Playera", quantity: 50 },
      { customName: "Gorra", quantity: 12 },
    ],
  });
  expect(creado.clientNameOverride).toBeUndefined();
  expect(creado.productionArea).toBeUndefined();
  expect(creado.deliveryDate).toBeUndefined();
  // El panel se cerró y no quedó borrador.
  await expect(page.getByRole("dialog", { name: "Nuevo pedido" })).toHaveCount(0);
  expect(await page.evaluate(() => Object.keys(window.localStorage).filter((k) => k.startsWith("emd:orderDraft:")))).toEqual([]);
});
