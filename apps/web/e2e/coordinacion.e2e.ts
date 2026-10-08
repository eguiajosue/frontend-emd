import { expect, test } from "@playwright/test";
import { login } from "./helpers";

const shots = process.env.E2E_SHOTS_DIR;

test("Coordinación: atrasados con motivo, carga por área y tiempos", async ({ page }) => {
  await login(page, "recepcion1");
  await page.goto("/dashboard/coordinacion");
  await expect(page.getByRole("heading", { name: "Pedidos atrasados" })).toBeVisible();
  await expect(page.getByText("4 días tarde")).toBeVisible();
  await expect(page.getByText("1 sin motivo registrado", { exact: false })).toBeVisible();

  const motivo = page.getByRole("combobox", { name: "Motivo del atraso del pedido #102" });
  await motivo.click();
  await page.getByRole("option", { name: "Esperando al cliente" }).click();
  await expect(page.getByText("Pedido #102: motivo guardado")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Detalle del atraso del pedido #102" })).toBeVisible();

  await expect(page.getByRole("list", { name: "Carga por persona en Bordado" })).toContainText("Luis");
  await expect(page.getByRole("heading", { name: "Tiempos por etapa" })).toBeVisible();
  if (shots) await page.screenshot({ path: `${shots}/coordinacion.png`, fullPage: true });
  if (shots) {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.screenshot({ path: `${shots}/coordinacion-oscuro.png`, fullPage: true });
  }
});
