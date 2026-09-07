import { expect, test } from "@playwright/test";
import { abrirTablero, login } from "./helpers";

/**
 * Los tres flujos que más duele que se rompan, y donde salieron los bugs de
 * esta semana: el tablero ubicaba los pedidos por un dato y escribía en otro,
 * el logout terminaba en un 404 de Vercel, y el detalle no decía de quién era
 * el trabajo.
 */

test.beforeEach(async ({ page }) => {
  await login(page);
});

test("1 · el tablero separa Diseño de Producción y no los mezcla", async ({ page }) => {
  await abrirTablero(page);

  // Recepción ve los dos circuitos, uno a la vez.
  const diseno = page.getByRole("tab", { name: /Diseño/ });
  const produccion = page.getByRole("tab", { name: /Producción/ });
  await expect(diseno).toBeVisible();
  await expect(produccion).toBeVisible();

  // Producción: las cinco columnas del flujo, y ninguna del circuito de diseño.
  await produccion.click();
  for (const columna of ["pendiente", "en proceso", "terminado", "entregado", "cancelado"]) {
    await expect(page.getByRole("region", { name: columna })).toBeVisible();
  }
  await expect(page.getByRole("region", { name: "en diseño" })).toHaveCount(0);

  // El pedido autorizado, cuya tarea de bordado está en "pendiente", tiene que
  // aparecer en "pendiente" y no en una columna "autorizado".
  await expect(
    page.getByRole("region", { name: "pendiente" }).getByText("#101"),
  ).toBeVisible();

  // Diseño: sus propias etapas, y el pedido que sigue en montaje.
  await diseno.click();
  for (const columna of ["en diseño", "esperando autorización", "autorizado"]) {
    await expect(page.getByRole("region", { name: columna })).toBeVisible();
  }
  await expect(page.getByRole("region", { name: "en proceso" })).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "en diseño" }).getByText("#102"),
  ).toBeVisible();
});

test("2 · el detalle dice de quién es el trabajo y qué falta", async ({ page }) => {
  await page.goto("/dashboard/orders");
  await page.getByText("Colegio San Marcos").first().click();

  // La tira de pase: el pedido está autorizado, así que la pelota es del área.
  await expect(page.getByRole("region", { name: "Pase del pedido" })).toBeVisible();
  // `Ahora en` vive en su propio span; la frase entera está en el párrafo.
  await expect(page.getByText(/Ahora en/).locator("xpath=..")).toContainText(
    "Producción",
  );
  await expect(page.getByText(/El área toma el pedido|Cada área marca/)).toBeVisible();

  // Recepción no ve botones de trabajo del área: ve quién la tiene y puede
  // reasignar. "Tomar" se asigna a uno mismo y el backend se lo rechaza.
  await expect(page.getByRole("button", { name: "Tomar" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Empezar" })).toHaveCount(0);
  await expect(
    page.getByRole("combobox", { name: /Responsable de Bordado/ }),
  ).toBeVisible();
});

test("3 · el logout vuelve al login y no a un 404", async ({ page }) => {
  // Regresión: `signOut({ callbackUrl })` armaba el destino desde NEXTAUTH_URL,
  // que apuntaba a un deploy de Vercel ya borrado, y el logout terminaba en
  // "404: NOT_FOUND / DEPLOYMENT_NOT_FOUND".
  await page.goto("/dashboard/orders");
  await page.getByRole("button", { name: /Logout/i }).click();
  await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
  await expect(page.locator("#username")).toBeVisible();
});
