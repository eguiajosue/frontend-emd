import { expect, test } from "@playwright/test";
import { login } from "./helpers";
import { WHATSAPP_FIXTURE } from "../src/lib/quotes/whatsappFixture";

/**
 * Cotizaciones (docs/plans/cotizaciones.md): Recepción pega el listado real
 * de WhatsApp, lo crea en bloque, mueve una a Aceptada y copia la lista de
 * vuelta para el chat. Contra el backend de mentira (`/quotes` en memoria).
 */

const MOCK_API = `http://localhost:${process.env.MOCK_API_PORT ?? 4010}`;

test.beforeEach(async ({ request }) => {
  await request.post(`${MOCK_API}/__e2e/reset`);
});

test("pegar de WhatsApp, cambiar a Aceptada y copiar para WhatsApp", async ({ page, context, request }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await login(page);
  await expect(page).toHaveURL(/\/dashboard\/inicio/, { timeout: 30_000 });

  // Se llega desde el menú (Operación › Cotizaciones).
  await page.getByRole("link", { name: "Cotizaciones" }).first().click();
  await expect(page).toHaveURL(/\/dashboard\/cotizaciones/);
  await expect(page.getByRole("heading", { level: 1, name: "Cotizaciones" })).toBeVisible();
  await expect(page.getByText("Todavía no hay cotizaciones")).toBeVisible();

  // Pegar el listado real y revisar la vista previa.
  await page.getByRole("button", { name: "Pegar de WhatsApp" }).first().click();
  const paste = page.getByRole("dialog", { name: "Pegar de WhatsApp" });
  await paste.getByLabel("Listado de WhatsApp").fill(WHATSAPP_FIXTURE);
  await expect(paste.getByText("13 cotizaciones detectadas")).toBeVisible();
  await paste.getByRole("button", { name: "Revisar (13)" }).click();
  const preview = page.getByRole("dialog", { name: "Revisa antes de crear" });
  await expect(preview.getByTestId("paste-row")).toHaveCount(13);
  await expect(preview.getByLabel("Cliente, línea 10")).toHaveValue("BRICER");
  await preview.getByRole("button", { name: "Crear 13 cotizaciones" }).click();
  await expect(preview).toBeHidden();

  // 8 por enviar, 5 enviadas.
  await expect(page.getByTestId("count-por_enviar")).toHaveText("8");
  await expect(page.getByTestId("count-enviada")).toHaveText("5");
  await expect(page.getByTestId("quote-card")).toHaveCount(8);
  // Las de prioridad van primero (hoy, luego mañana).
  await expect(page.getByTestId("quote-card").first().getByTestId("quote-priority")).toHaveText("Hoy");

  // DDN pasa a Aceptada con un clic: se va a Enviadas.
  const ddn = page.getByRole("article", { name: "DDN" });
  await ddn.getByRole("button", { name: "Subestado: Lista. Cambiar" }).click();
  await page.getByRole("menuitemradio", { name: "Aceptada" }).click();
  await expect(page.getByTestId("count-por_enviar")).toHaveText("7");
  await expect(page.getByTestId("count-enviada")).toHaveText("6");
  await expect.poll(async () => {
    const saved = await (await request.get(`${MOCK_API}/__e2e/quotes`)).json();
    return saved.find((q: { clientName: string }) => q.clientName === "DDN")?.status;
  }).toBe("aceptada");

  await page.getByRole("tab", { name: /Enviadas/ }).click();
  const ddnSent = page.getByRole("article", { name: "DDN" });
  await expect(ddnSent.getByRole("button", { name: "Subestado: Aceptada. Cambiar" })).toBeVisible();
  await expect(ddnSent.getByRole("button", { name: "Convertir en pedido" })).toBeVisible();

  // Copiar todas para WhatsApp.
  await page.getByRole("button", { name: "Copiar para WhatsApp" }).click();
  await page.getByRole("menuitem", { name: /Todas/ }).click();
  await expect(page.getByText("Copiado: 13 cotizaciones")).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  const lines = copied.split("\n");
  expect(lines).toHaveLength(13);
  expect(lines).toContain("* DDN . ✅enviada - aceptada *HOY");
  expect(lines).toContain("* IHS . ☑️en espera de montajes *prioridad mañana");
  expect(lines).toContain("* OFISDECO . ✅enviada - en espera de montajes");
  expect(lines).toContain("* ESTEBAN TALAMAS . ☑️pendiente medidas - pendiente lleve la camioneta para medir");
});
