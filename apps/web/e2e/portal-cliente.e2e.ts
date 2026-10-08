import { expect, login, test } from "./helpers";

/**
 * Portal del cliente: Recepción comparte el enlace del pedido, el cliente lo
 * abre SIN sesión (desde su teléfono), revisa el diseño y pide cambios; su
 * respuesta le llega a Recepción, que la confirma con el flujo de siempre.
 */

const MOCK_API = "http://localhost:4010";
const ORDEN = 110;
const shots = process.env.E2E_SHOTS_DIR;

test.beforeEach(async ({ request }) => {
  await request.post(`${MOCK_API}/__e2e/reset-tareas`);
  await request.post(`${MOCK_API}/__e2e/reset-portal`);
});

test.afterAll(async ({ request }) => {
  await request.post(`${MOCK_API}/__e2e/reset-portal`);
});

test("Recepción comparte, el cliente pide cambios y Recepción lo confirma", async ({ page, browser }) => {
  await login(page, "recepcion1");
  await page.goto(`/dashboard/orders?openOrderId=${ORDEN}`);
  await page.getByRole("button", { name: /Compartir/ }).first().click();

  const dialogo = page.getByRole("dialog", { name: "Compartir con el cliente" });
  const enlace = dialogo.getByRole("textbox", { name: "Enlace del pedido" });
  await expect(enlace).toHaveValue(/\/p\/tok110/);
  const url = await enlace.inputValue();
  await expect(dialogo.getByText("Todavía no lo abre")).toBeVisible();
  await expect(dialogo.getByRole("link", { name: /WhatsApp/ })).toHaveAttribute("href", /^https:\/\/wa\.me\//);
  await dialogo.getByRole("button", { name: "Código QR" }).click();
  await expect(dialogo.getByRole("img", { name: "Código QR del enlace del pedido" })).toBeVisible();
  if (shots) await dialogo.screenshot({ path: `${shots}/portal-compartir.png` });
  await page.keyboard.press("Escape");

  // El cliente, sin sesión y en el teléfono.
  const cliente = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const tel = await cliente.newPage();
  await tel.goto(url);
  await expect(tel.getByRole("heading", { name: "40 playeras con escudo bordado" })).toBeVisible();
  await expect(tel.getByText("Hola, Escuela Primaria Benito Juárez")).toBeVisible();
  await expect(tel.getByRole("list", { name: "Etapas de tu pedido" }).locator("[aria-current='step']")).toContainText("Tu aprobación");
  await expect(tel.getByText("Playera escolar")).toBeVisible();
  await expect(tel.locator("main img").first()).toBeVisible();
  if (shots) await tel.screenshot({ path: `${shots}/portal-cliente.png`, fullPage: true });

  await tel.getByRole("button", { name: "Pedir cambios" }).click();
  await tel.getByLabel("Comentario").fill("El escudo un poco más grande, por favor");
  await tel.getByRole("button", { name: "Enviar cambios" }).click();
  await expect(tel.getByText("¡Gracias! Recibimos tu respuesta.")).toBeVisible();
  if (shots) await tel.screenshot({ path: `${shots}/portal-gracias.png`, fullPage: true });
  await cliente.close();

  // Recepción ve la respuesta en el pedido y la confirma.
  await page.reload();
  const tarjeta = page.getByRole("region", { name: "Respuesta del cliente desde su enlace" });
  await expect(tarjeta).toContainText("El cliente pidió cambios desde su enlace");
  await expect(tarjeta).toContainText("El escudo un poco más grande, por favor");
  await expect(tarjeta).toContainText("Visto");
  if (shots) await tarjeta.screenshot({ path: `${shots}/portal-recepcion.png` });
  await tarjeta.getByRole("button", { name: "Confirmar y mandar a Diseño" }).click();
  await expect(page.getByPlaceholder(/agrandar el logo/)).toHaveValue("El escudo un poco más grande, por favor");
});

test("un enlace desactivado ya no abre", async ({ page, browser, request }) => {
  await login(page, "recepcion1");
  await page.goto(`/dashboard/orders?openOrderId=${ORDEN}`);
  await page.getByRole("button", { name: /Compartir/ }).first().click();
  const url = await page.getByRole("textbox", { name: "Enlace del pedido" }).inputValue();
  await page.getByRole("button", { name: "Desactivar enlace" }).click();
  await expect.poll(async () => (await (await request.get(`${MOCK_API}/orders/${ORDEN}/share-link`)).json()).link).toBeNull();

  const cliente = await browser.newContext();
  const tel = await cliente.newPage();
  await tel.goto(url);
  await expect(tel.getByRole("heading", { name: "No encontramos este pedido" })).toBeVisible();
  await cliente.close();
});
