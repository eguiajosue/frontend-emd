import { expect, test, abrirTablero, login } from "./helpers";

/**
 * Los flujos que más duele que se rompan, y donde salieron los bugs de
 * esta semana: el tablero ubicaba los pedidos por un dato y escribía en otro,
 * el logout terminaba en un 404 de Vercel, y el detalle no decía de quién era
 * el trabajo.
 */

test.beforeEach(async ({ page }) => {
  await login(page);
});

test("1 · el tablero separa Diseño de Producción y no los mezcla", async ({ page }) => {
  await abrirTablero(page);

  // Recepción ve los dos circuitos, uno a la vez (selector "Circuito").
  const circuito = page.getByRole("radiogroup", { name: "Circuito" });
  const diseno = circuito.getByRole("radio", { name: /Diseño/ });
  const produccion = circuito.getByRole("radio", { name: /Producción/ });
  await expect(diseno).toBeVisible();
  await expect(produccion).toBeVisible();

  // Producción: las columnas del flujo, y ninguna del circuito de diseño.
  // "cancelado" queda archivado: sólo aparece con el toggle "Archivados".
  await produccion.click();
  for (const columna of ["pendiente", "en proceso", "terminado", "entregado"]) {
    await expect(page.getByRole("region", { name: columna })).toBeVisible();
  }
  await expect(page.getByRole("region", { name: "cancelado" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "en diseño" })).toHaveCount(0);

  // El pedido autorizado, cuya tarea de bordado está en "pendiente", tiene que
  // aparecer en "pendiente" y no en una columna "autorizado".
  await expect(
    page.getByRole("region", { name: "pendiente" }).getByText("#101"),
  ).toBeVisible();

  // Diseño: sus propias etapas, y el pedido que sigue en montaje. "autorizado"
  // ya no es columna de Diseño: el pedido pasa al tablero de Producción.
  await diseno.click();
  for (const columna of ["cambios solicitados", "en diseño", "esperando autorización"]) {
    await expect(page.getByRole("region", { name: columna })).toBeVisible();
  }
  await expect(page.getByRole("region", { name: "en proceso" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "autorizado" })).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "en diseño" }).getByText("#102"),
  ).toBeVisible();
});

test("2 · el detalle dice de quién es el trabajo y qué falta", async ({ page }) => {
  await page.goto("/dashboard/orders");
  // La tarjeta entera es un botón (capa encima del texto).
  await page.getByRole("button", { name: /Ver detalle del pedido #101/ }).click();

  // La tira de pase: el pedido está autorizado, así que la pelota es del área.
  await expect(page.getByRole("region", { name: "Dónde está el pedido" })).toBeVisible();
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
  // El botón de salir vive al pie del menú lateral ("Cerrar sesión").
  await page
    .getByRole("complementary", { name: "Navegación principal" })
    .getByRole("button", { name: "Cerrar sesión" })
    .click();
  await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
  await expect(page.locator("#username")).toBeVisible();
});

test("4 · exportar a Excel descarga un .xlsx válido", async ({ page }) => {
  // `xlsx` (SheetJS 0.18.5 de npm, sin parches) se cambió por
  // `write-excel-file`: el archivo tiene que seguir saliendo igual.
  await page.goto("/dashboard/orders");
  await page.getByRole("button", { name: "Exportar" }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("menuitem", { name: /Excel/ }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^pedidos-\d{4}-\d{2}-\d{2}\.xlsx$/);

  const path = await download.path();
  const { readFileSync } = await import("node:fs");
  const bytes = readFileSync(path!);
  // Un .xlsx es un zip (firma "PK") que trae xl/workbook.xml.
  expect(bytes.subarray(0, 2).toString("latin1")).toBe("PK");
  expect(bytes.includes(Buffer.from("xl/workbook.xml"))).toBe(true);
});
