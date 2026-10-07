import { expect, test, login } from "./helpers";

/**
 * Sucursal "Punto Madero": una cuenta compartida que sólo levanta pedidos,
 * usa Mockups y ve SUS pedidos; admin administra a sus empleados.
 */

const MOCK_API = `http://localhost:${process.env.MOCK_API_PORT ?? 4010}`;

test.beforeEach(async ({ request }) => {
  await request.post(`${MOCK_API}/__e2e/reset-branches`);
  await request.post(`${MOCK_API}/__e2e/reset-preferences`);
});

test("la sucursal sólo ve Nuevo pedido, Mis pedidos y Mockups, y sólo sus pedidos", async ({ page }) => {
  await login(page, "puntomadero");
  await expect(page).toHaveURL(/\/dashboard\/orders/);

  const rail = page.getByRole("navigation", { name: "Secciones" });
  await expect(rail.getByRole("link")).toHaveCount(3);
  for (const name of ["Nuevo pedido", "Mis pedidos", "Mockups"]) {
    await expect(rail.getByRole("link", { name })).toBeVisible();
  }

  // Sólo el pedido de la sucursal (el 101 y el 102 son de la matriz).
  await expect(page.getByText("Escuela Madero").first()).toBeVisible();
  await expect(page.getByText("Colegio San Marcos")).toHaveCount(0);
  await expect(page.getByText("Ferretería El Tornillo")).toHaveCount(0);
  await expect(page.getByTestId("branch-badge").first()).toHaveText("Punto Madero");

  // Otras secciones la devuelven a Mis pedidos.
  await page.goto("/dashboard/usuarios");
  await expect(page).toHaveURL(/\/dashboard\/orders/);
  await page.goto("/dashboard/clientes");
  await expect(page).toHaveURL(/\/dashboard\/orders/);
});

test("al crear un pedido hay que elegir al empleado, y queda guardado", async ({ page, request }) => {
  await login(page, "puntomadero");
  await page.goto("/dashboard/orders?new=1");

  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox", { name: "Cliente" }).click();
  await page.getByPlaceholder("Buscar cliente…").fill("Escuela Norte");
  await page.getByText('Usar "Escuela Norte" como nombre de cliente').click();
  await dialog.getByRole("radio", { name: "Sin diseño" }).click();
  await dialog.getByRole("group", { name: /^Áreas de producción/ }).getByRole("button", { name: /Taller/ }).click();
  await dialog.getByRole("combobox", { name: "Agregar producto" }).click();
  await page.getByPlaceholder("+ Agregar producto…").fill("Playera");
  await page.getByText('Usar "Playera" como producto nuevo').click();
  await dialog.getByLabel("Cantidad de Playera").fill("5");
  await dialog.getByLabel("Descripción").fill("Playeras del torneo");

  // Sin empleado no se crea.
  await dialog.getByRole("button", { name: /Crear pedido/ }).click();
  await expect(dialog.getByText("Elige quién levanta el pedido").first()).toBeVisible();
  expect(await (await request.get(`${MOCK_API}/__e2e/branch-orders`)).json()).toHaveLength(0);

  // Sólo los empleados activos: Beto Ruiz está inactivo.
  await dialog.getByRole("combobox", { name: /¿Quién levanta el pedido\?/ }).click();
  await expect(page.getByRole("option", { name: "Ana López" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Beto Ruiz" })).toHaveCount(0);
  await page.getByRole("option", { name: "Carla Díaz" }).click();

  await dialog.getByRole("button", { name: /Crear pedido/ }).click();
  await expect
    .poll(async () => (await (await request.get(`${MOCK_API}/__e2e/branch-orders`)).json()).length)
    .toBe(1);
  const [creado] = await (await request.get(`${MOCK_API}/__e2e/branch-orders`)).json();
  expect(creado.branchEmployeeId).toBe(3);

  // El detalle muestra quién lo creó.
  await expect(page.getByTestId("branch-origin")).toHaveText("Creado por Punto Madero · Carla Díaz");
});

test("admin administra los empleados de la sucursal", async ({ page }) => {
  await login(page, "admin1");
  await page.goto("/dashboard/usuarios?tab=sucursales");

  const branch = page.getByRole("region", { name: "Sucursal Punto Madero" });
  await expect(branch.getByText("Ana López")).toBeVisible();

  // Alta.
  await branch.getByLabel("Nuevo empleado de Punto Madero").fill("Diego Sol");
  await branch.getByRole("button", { name: /Agregar empleado/ }).click();
  await expect(branch.getByText("Diego Sol")).toBeVisible();

  // Renombrar.
  await branch.getByRole("button", { name: "Renombrar a Diego Sol" }).click();
  await branch.getByLabel("Nuevo nombre de Diego Sol").fill("Diego Soto");
  await branch.getByRole("button", { name: "Guardar nombre" }).click();
  await expect(branch.getByText("Diego Soto")).toBeVisible();

  // Desactivar: pasa a "Inactivo".
  await branch.getByRole("switch", { name: "Desactivar a Diego Soto" }).click();
  await expect(branch.getByTestId(/^employee-/).filter({ hasText: "Diego Soto" }).getByText("Inactivo")).toBeVisible();
});
