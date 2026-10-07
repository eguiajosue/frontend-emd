import { expect, login, test } from "./helpers";

/**
 * Autorizar → Hoja de materiales → producción. Recepción marca que el cliente
 * autorizó el pedido #110 y en el mismo paso dice, por área, de dónde sale el
 * insumo. Lo "nuestro" ligado a inventario queda apartado y se descuenta
 * cuando Bordado termina su tarea. Todo bajo la CSP real.
 */

const MOCK_API = "http://localhost:4010";

test.beforeEach(async ({ request }) => {
  await request.post(`${MOCK_API}/__e2e/reset-tareas`);
});

test("1 · autorizar con insumos nuestros: aparta, aparece en la tarea y se descuenta al terminar", async ({ page, request }) => {
  await login(page, "recepcion1");
  await page.goto("/dashboard/orders?openOrderId=110");
  await page.getByRole("button", { name: "Autorizó" }).click();

  const dialog = page.getByRole("dialog").filter({ hasText: "El cliente autorizó la ronda 1" });
  await expect(dialog).toContainText("Hoja de materiales");
  const pasar = dialog.getByRole("button", { name: "Pasar a producción" });
  await expect(pasar).toBeDisabled();

  await dialog.getByRole("radio", { name: "Bordado: lo ponemos nosotros" }).click();
  await expect(pasar).toBeDisabled();
  await dialog.getByLabel("Bordado: buscar insumo en inventario").fill("hilo");
  await dialog.getByRole("button", { name: /Hilo poliéster rojo 1147/ }).click();
  const cantidad = dialog.getByLabel("Bordado: cantidad de Hilo poliéster rojo 1147");
  await cantidad.fill("2");
  await expect(pasar).toBeEnabled();
  await pasar.click();

  // Autorización + hoja viajaron juntas.
  const { recibido } = await (await request.get(`${MOCK_API}/__e2e/autorizacion`)).json();
  expect(recibido.supplies).toEqual([
    { area: "bordado", source: "nosotros", lines: [{ inventoryItemId: 1, description: "Hilo poliéster rojo 1147", quantity: 2 }] },
  ]);

  // Reservado, sin descontar todavía.
  const panel = page.getByRole("region", { name: "Origen de insumos por área" });
  await expect(panel).toContainText("Lo ponemos nosotros");
  await expect(panel).toContainText("Apartado");
  expect((await (await request.get(`${MOCK_API}/inventory/1`)).json()).quantity).toBe(12);
  expect((await (await request.get(`${MOCK_API}/inventory/1`)).json()).available).toBe(10);

  // Bordado ve el origen de insumos en su tarea y al terminar se descuenta.
  await page.context().clearCookies();
  await login(page, "bordado");
  await page.goto("/dashboard/tareas");
  const tarjeta = page.getByRole("article").filter({ hasText: "40 playeras con escudo bordado" });
  await expect(tarjeta.getByTestId("area-supply-summary")).toContainText(
    "Insumos: nuestros — Hilo poliéster rojo 1147 2 cono"
  );
  await tarjeta.getByRole("button", { name: /empezar/i }).click();
  await tarjeta.getByRole("button", { name: "Terminar" }).click();

  await expect
    .poll(async () => (await (await request.get(`${MOCK_API}/inventory/1`)).json()).quantity)
    .toBe(10);
  const hoja = await (await request.get(`${MOCK_API}/orders/110/area-supplies`)).json();
  expect(hoja.areas[0].supply.lines[0].state).toBe("descontado");
  expect(hoja.movements[0]).toMatchObject({ type: "SALIDA", delta: -2, areaTaskId: 90 });
});

test("2 · insumos del cliente: se ven en la tarea y no tocan inventario", async ({ page, request }) => {
  await login(page, "recepcion1");
  await page.goto("/dashboard/orders?openOrderId=110");
  await page.getByRole("button", { name: "Autorizó" }).click();

  const dialog = page.getByRole("dialog").filter({ hasText: "El cliente autorizó la ronda 1" });
  await dialog.getByRole("radio", { name: "Bordado: lo trae el cliente" }).click();
  await dialog.getByLabel("Bordado: descripción del insumo del cliente").fill("playeras negras");
  await dialog.getByLabel("Bordado: cantidad del insumo del cliente").fill("40");
  await dialog.getByRole("button", { name: "Pasar a producción" }).click();

  await page.context().clearCookies();
  await login(page, "bordado");
  await page.goto("/dashboard/tareas");
  const tarjeta = page.getByRole("article").filter({ hasText: "40 playeras con escudo bordado" });
  await expect(tarjeta.getByTestId("area-supply-summary")).toContainText("Insumos: del cliente — 40 × playeras negras");

  const inv = await (await request.get(`${MOCK_API}/inventory/1`)).json();
  expect(inv.quantity).toBe(12);
  expect(inv.reserved).toBe(0);
});

test("3 · 'Lo trae el cliente' con la línea en blanco no bloquea: se manda sin detalle", async ({ page, request }) => {
  await login(page, "recepcion1");
  await page.goto("/dashboard/orders?openOrderId=110");
  await page.getByRole("button", { name: "Autorizó" }).click();

  const dialog = page.getByRole("dialog").filter({ hasText: "El cliente autorizó la ronda 1" });
  await dialog.getByRole("radio", { name: "Bordado: lo trae el cliente" }).click();
  // La línea sembrada se deja vacía a propósito.
  await expect(dialog.getByLabel("Bordado: descripción del insumo del cliente")).toHaveValue("");
  const pasar = dialog.getByRole("button", { name: "Pasar a producción" });
  await expect(pasar).toBeEnabled();
  await pasar.click();

  const { recibido } = await (await request.get(`${MOCK_API}/__e2e/autorizacion`)).json();
  expect(recibido.supplies).toEqual([{ area: "bordado", source: "cliente", lines: [] }]);
});

test("4 · terminar sin stock suficiente no falla: queda 'Pendiente de descontar' y Recepción lo descuenta tras reponer", async ({
  page,
  request,
}) => {
  await login(page, "recepcion1");
  await page.goto("/dashboard/orders?openOrderId=110");
  await page.getByRole("button", { name: "Autorizó" }).click();
  const dialog = page.getByRole("dialog").filter({ hasText: "El cliente autorizó la ronda 1" });
  await dialog.getByRole("radio", { name: "Bordado: lo ponemos nosotros" }).click();
  await dialog.getByLabel("Bordado: buscar insumo en inventario").fill("hilo");
  await dialog.getByRole("button", { name: /Hilo poliéster rojo 1147/ }).click();
  // Hay 12 conos: se piden 15.
  await dialog.getByLabel("Bordado: cantidad de Hilo poliéster rojo 1147").fill("15");
  await dialog.getByRole("button", { name: "Pasar a producción" }).click();
  await expect(page.getByRole("region", { name: "Origen de insumos por área" })).toContainText("Apartado");

  // Bordado termina: la tarea queda terminada aunque no alcance el stock.
  await page.context().clearCookies();
  await login(page, "bordado");
  await page.goto("/dashboard/tareas");
  const tarjeta = page.getByRole("article").filter({ hasText: "40 playeras con escudo bordado" });
  await tarjeta.getByRole("button", { name: /empezar/i }).click();
  await tarjeta.getByRole("button", { name: "Terminar" }).click();
  await expect.poll(async () => (await (await request.get(`${MOCK_API}/orders/110/area-supplies`)).json()).areas[0].status).toBe("terminado");
  expect((await (await request.get(`${MOCK_API}/inventory/1`)).json()).quantity).toBe(12);

  // Recepción ve la línea en ámbar con lo que falta.
  await page.context().clearCookies();
  await login(page, "recepcion1");
  await page.goto("/dashboard/orders?openOrderId=110");
  const panel = page.getByRole("region", { name: "Origen de insumos por área" });
  await expect(panel.getByTestId("supply-pending")).toContainText("Pendiente de descontar — faltan 3 cono");

  // Se repone stock y se reintenta.
  await request.post(`${MOCK_API}/__e2e/reponer-stock`, { data: { itemId: 1, quantity: 5 } });
  await panel.getByRole("button", { name: "Descontar pendientes" }).click();
  await expect(panel.getByText("Descontado")).toBeVisible();
  await expect(panel.getByTestId("supply-pending")).toHaveCount(0);
  expect((await (await request.get(`${MOCK_API}/inventory/1`)).json()).quantity).toBe(2);
});
