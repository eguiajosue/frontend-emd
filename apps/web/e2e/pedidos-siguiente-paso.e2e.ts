import type { Page } from "@playwright/test";
import { expect, login, test } from "./helpers";

/**
 * "Qué sigue" en las tarjetas de Pedidos: la línea de etapas, a quién le
 * toca y un botón con el verbo. El cambio es inmediato y trae "Deshacer";
 * con teclado: flechas para elegir, Enter para avanzar, Z para deshacer.
 */

const MOCK_API = "http://localhost:4010";
const shots = process.env.E2E_SHOTS_DIR;

test.beforeEach(async ({ page, request }) => {
  await request.post(`${MOCK_API}/__e2e/reset-tareas`);
  await login(page, "recepcion1");
  await page.goto("/dashboard/orders");
  await page.getByRole("radiogroup", { name: "Vista" }).getByRole("radio", { name: "Lista" }).click();
});

test.afterAll(async ({ request }) => {
  await request.post(`${MOCK_API}/__e2e/reset-tareas`);
});

const tarjeta = (page: Page, id: number) => page.locator(`[data-order-card="${id}"]`).first();

test("1 · un clic da el siguiente paso y Deshacer lo regresa", async ({ page }) => {
  const card = tarjeta(page, 101);
  await expect(card.getByRole("list", { name: "Etapas del pedido" })).toBeVisible();
  // Recepción ve de quién es el turno (Bordado) y aun así puede moverlo.
  await expect(card).toContainText("Turno de: Bordado");
  if (shots) await page.screenshot({ path: `${shots}/pedidos-lista.png`, fullPage: true });

  await card.getByRole("button", { name: "Empezar producción · pedido #101" }).click();
  const aviso = page.getByText("Pedido #101 → en proceso");
  await expect(aviso).toBeVisible();
  await expect(card.getByRole("button", { name: "Marcar terminado · pedido #101" })).toBeVisible();

  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(card.getByRole("button", { name: "Empezar producción · pedido #101" })).toBeVisible();
});

test("2 · con teclado: flechas eligen, Enter avanza, Z deshace, / busca", async ({ page }) => {
  await expect(tarjeta(page, 101)).toBeVisible();
  await page.keyboard.press("/");
  await page.getByRole("textbox", { name: "Número de pedido" }).fill("101");
  await page.keyboard.press("Enter");
  await expect(tarjeta(page, 101)).toHaveAttribute("aria-current", "true");

  await page.keyboard.press("Enter");
  await expect(tarjeta(page, 101).getByRole("button", { name: "Marcar terminado · pedido #101" })).toBeVisible();
  await page.keyboard.press("z");
  await expect(tarjeta(page, 101).getByRole("button", { name: "Empezar producción · pedido #101" })).toBeVisible();

  await page.keyboard.press("?");
  await expect(page.getByRole("heading", { name: "Atajos de teclado" })).toBeVisible();
});

test("3 · Modo TV: tarjetas con su paso y atajos a la vista", async ({ page }) => {
  await page.getByRole("button", { name: "Modo TV" }).click();
  const tele = page.getByRole("dialog", { name: "Pedidos en curso" });
  await expect(tele).toBeVisible();
  await expect(tele.getByLabel("Atajos de teclado")).toContainText("siguiente paso");
  const card = tele.locator('[data-order-card="101"]');
  await expect(card.getByRole("button", { name: "Empezar producción · pedido #101" })).toBeVisible();

  // Flechas hasta el #101 y Enter.
  for (let i = 0; i < 6; i++) {
    if ((await card.getAttribute("aria-current")) === "true") break;
    await page.keyboard.press("ArrowRight");
  }
  await expect(card).toHaveAttribute("aria-current", "true");
  if (shots) await page.screenshot({ path: `${shots}/pedidos-tv.png` });
  await page.keyboard.press("Enter");
  await expect(card.getByRole("button", { name: "Marcar terminado · pedido #101" })).toBeVisible();
  await page.keyboard.press("z");
  await expect(card.getByRole("button", { name: "Empezar producción · pedido #101" })).toBeVisible();
});
