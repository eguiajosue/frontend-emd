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

test("la sucursal ve Mis pedidos, Historial, Clientes y Mockups (sin Nuevo pedido ni Inventario), y sólo sus pedidos", async ({ page }) => {
  await login(page, "puntomadero");
  await expect(page).toHaveURL(/\/dashboard\/orders/);

  const rail = page.getByRole("navigation", { name: "Secciones" });
  await expect(rail.getByRole("link")).toHaveCount(4);
  for (const name of ["Mis pedidos", "Historial", "Clientes", "Mockups"]) {
    await expect(rail.getByRole("link", { name })).toBeVisible();
  }
  await expect(rail.getByRole("link", { name: "Nuevo pedido" })).toHaveCount(0);
  await expect(rail.getByRole("link", { name: "Inventario" })).toHaveCount(0);

  // Sólo el pedido de la sucursal (el 101 y el 102 son de la matriz).
  await expect(page.getByText("Escuela Madero").first()).toBeVisible();
  await expect(page.getByText("Colegio San Marcos")).toHaveCount(0);
  await expect(page.getByText("Ferretería El Tornillo")).toHaveCount(0);
  await expect(page.getByTestId("branch-badge").first()).toHaveText("Punto Madero");

  // Otras secciones la devuelven a Mis pedidos.
  await page.goto("/dashboard/usuarios");
  await expect(page).toHaveURL(/\/dashboard\/orders/);
  await page.goto("/dashboard/chat");
  await expect(page).toHaveURL(/\/dashboard\/orders/);
});

test("'Nuevo pedido' ya no está en el menú: se crea con el botón de Mis pedidos", async ({ page }) => {
  await login(page, "puntomadero");
  await page.goto("/dashboard/orders");

  await page.getByRole("button", { name: /Nuevo Pedido/ }).click();
  await expect(page.getByRole("dialog", { name: "Nuevo pedido" })).toBeVisible();
});

test("sin inventario: ni en el menú ni por URL, y ninguna pantalla lo consulta", async ({ page, request }) => {
  await login(page, "puntomadero");
  const rail = page.getByRole("navigation", { name: "Secciones" });
  await expect(rail.getByRole("link", { name: "Inventario" })).toHaveCount(0);

  // La paleta de comandos tampoco lo ofrece.
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("option", { name: /Mis pedidos/ })).toBeVisible();
  await expect(page.getByRole("option", { name: /Inventario/ })).toHaveCount(0);
  await page.keyboard.press("Escape");

  // URL directa: vuelve a Mis pedidos.
  for (const ruta of ["/dashboard/inventario"]) {
    await page.goto(ruta);
    await expect(page).toHaveURL(/\/dashboard\/orders/);
  }

  // Recorre sus pantallas: el backend nunca recibió una petición a /inventory.
  for (const ruta of ["/dashboard/orders", "/dashboard/mi-historial", "/dashboard/clientes", "/dashboard/mockups"]) {
    await page.goto(ruta);
    await page.waitForTimeout(500);
  }
  expect((await (await request.get(`${MOCK_API}/__e2e/forbidden-calls`)).json()).inventory).toBe(0);
});

test.describe("historial propio", () => {
  test.beforeEach(async ({ request }) => {
    // 25 pedidos extra (alternan pendiente / entregado) + el #110 = 26: dos páginas de 20.
    await request.post(`${MOCK_API}/__e2e/seed-branch-orders`, { data: { count: 25 } });
  });

  test("lista todos sus pedidos del más nuevo al más viejo, con paginación y detalle en lectura", async ({ page }) => {
    await login(page, "puntomadero");
    await page.getByRole("navigation", { name: "Secciones" }).getByRole("link", { name: "Historial" }).click();
    await expect(page).toHaveURL(/\/dashboard\/mi-historial/);
    await expect(page.getByRole("heading", { name: "Historial de pedidos" })).toBeVisible();

    const summary = page.getByTestId("branch-history-summary");
    await expect(summary).toContainText("Página 1 de 2 · 26 pedidos");
    // Del más nuevo al más viejo: el #110 (4 de septiembre) y luego los sembrados de agosto; los de matriz no aparecen.
    const filas = page.getByRole("list").getByRole("button", { name: /^Ver pedido #/ });
    await expect(filas).toHaveCount(20);
    await expect(filas.first()).toHaveAccessibleName("Ver pedido #110 de Escuela Madero");
    await expect(filas.nth(1)).toHaveAccessibleName("Ver pedido #224 de Cliente 25");
    await expect(page.getByText("Colegio San Marcos")).toHaveCount(0);
    await expect(filas.first()).toContainText("Ana López");

    await page.getByRole("button", { name: /Siguiente/ }).click();
    await expect(summary).toContainText("Página 2 de 2");
    await expect(filas).toHaveCount(6);
    await expect(filas.last()).toHaveAccessibleName("Ver pedido #200 de Cliente 1");

    // El clic abre el detalle en modo lectura.
    await page.getByRole("button", { name: /Anterior/ }).click();
    await page.getByRole("button", { name: "Ver pedido #224 de Cliente 25" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Cliente 25");
    await expect(dialog.getByRole("button", { name: /^Guardar/ })).toHaveCount(0);
  });

  test("filtra por búsqueda, estado y rango de fechas, y se puede limpiar", async ({ page }) => {
    await login(page, "puntomadero");
    await page.goto("/dashboard/mi-historial");
    const summary = page.getByTestId("branch-history-summary");
    await expect(summary).toContainText("26 pedidos");

    // Búsqueda por cliente.
    await page.getByLabel("Buscar en el historial").fill("Cliente 7");
    await expect(summary).toContainText("1 pedido");
    await expect(page.getByRole("button", { name: /Ver pedido #\d+ de Cliente 7/ })).toBeVisible();

    // Sin resultados.
    await page.getByLabel("Buscar en el historial").fill("zzz-no-existe");
    await expect(page.getByText("Sin pedidos con estos filtros")).toBeVisible();
    await page.getByRole("button", { name: /Limpiar filtros/ }).click();
    await expect(summary).toContainText("26 pedidos");

    // Estado: entregado (los pares: 12 de 25).
    await page.getByRole("combobox", { name: "Filtrar por estado" }).click();
    await page.getByRole("option", { name: "entregado" }).click();
    await expect(summary).toContainText("12 pedidos");

    // Rango de fechas de creación (10 al 12 de agosto = clientes 9, 10, 11; entregado = sólo el 10).
    await page.getByRole("button", { name: /Limpiar filtros/ }).click();
    await page.getByLabel("Creado desde").fill("2026-08-10");
    await page.getByLabel("Creado hasta").fill("2026-08-12");
    await expect(summary).toContainText("3 pedidos");
    await page.getByRole("combobox", { name: "Filtrar por estado" }).click();
    await page.getByRole("option", { name: "entregado" }).click();
    await expect(summary).toContainText("1 pedido");
    await expect(page.getByRole("button", { name: /de Cliente 10$/ })).toBeVisible();
  });

  test("sin pedidos muestra el estado vacío", async ({ page, request }) => {
    // Sin el seed y sin el #110 propio no hay forma de vaciarlo: filtra por un estado sin pedidos.
    await login(page, "puntomadero");
    await page.goto("/dashboard/mi-historial");
    await page.getByRole("combobox", { name: "Filtrar por estado" }).click();
    await page.getByRole("option", { name: "cancelado" }).click();
    await expect(page.getByText("Sin pedidos con estos filtros")).toBeVisible();
    void request;
  });

  test("en móvil las filas se apilan y siguen abriendo el detalle", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await login(page, "puntomadero");
    await page.goto("/dashboard/mi-historial");
    const fila = page.getByRole("button", { name: "Ver pedido #110 de Escuela Madero" });
    await expect(fila).toBeVisible();
    // Sin scroll horizontal de página.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await fila.click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});

test("clientes propios: sólo ve los suyos, crea uno y lo usa en un pedido", async ({ page, request }) => {
  await login(page, "puntomadero");
  await page.getByRole("navigation", { name: "Secciones" }).getByRole("link", { name: "Clientes" }).click();
  await expect(page).toHaveURL(/\/dashboard\/clientes/);

  // Sólo los de su sucursal; sin Empresas, plantillas ni eliminar.
  await expect(page.getByRole("heading", { name: "Clientes" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Escuela" }).first()).toBeVisible();
  await expect(page.getByText("Colegio")).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Empresas" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Eliminar" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Plantillas de pedido/ })).toHaveCount(0);

  // Alta: queda ligado a su sucursal sin que el front mande branchId.
  await page.getByRole("button", { name: /Nuevo Cliente/ }).first().click();
  const form = page.getByRole("dialog", { name: "Nuevo Cliente" });
  await form.getByRole("textbox").nth(0).fill("Papelería");
  await form.getByRole("textbox").nth(1).fill("La Esquina");
  await form.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("cell", { name: "Papelería" })).toBeVisible();
  const guardados = await (await request.get(`${MOCK_API}/__e2e/clients`)).json();
  expect(guardados.find((c: { first_name: string }) => c.first_name === "Papelería")).toMatchObject({ branchId: 1 });

  // Lo usa al crear un pedido (el selector sólo ofrece los suyos).
  await page.goto("/dashboard/orders?new=1");
  const dialog = page.getByRole("dialog", { name: "Nuevo pedido" });
  await dialog.getByRole("combobox", { name: "Cliente" }).click();
  await expect(page.getByRole("option", { name: /Papelería/ })).toBeVisible();
  await expect(page.getByRole("option", { name: /Colegio/ })).toHaveCount(0);
  await page.getByRole("option", { name: /Papelería/ }).click();
  await expect(dialog.getByText(/Papelería/).first()).toBeVisible();

  // No pidió empresas (el backend le contestaría 403).
  expect((await (await request.get(`${MOCK_API}/__e2e/forbidden-calls`)).json()).companies).toBe(0);
});

test("en el alta de pedido puede crear un cliente nuevo ahí mismo", async ({ page, request }) => {
  await login(page, "puntomadero");
  await page.goto("/dashboard/orders?new=1");
  const dialog = page.getByRole("dialog", { name: "Nuevo pedido" });
  await dialog.getByRole("button", { name: "Nuevo cliente" }).click();
  const alta = page.getByRole("dialog", { name: "Nuevo cliente" });
  await alta.getByLabel("Nombre").fill("Tienda Sol");
  await alta.getByRole("button", { name: /Crear|Guardar/ }).click();
  await expect(dialog.getByText("Tienda Sol").first()).toBeVisible();
  const guardados = await (await request.get(`${MOCK_API}/__e2e/clients`)).json();
  expect(guardados.find((c: { first_name: string }) => c.first_name === "Tienda Sol")).toMatchObject({ branchId: 1 });
});

test("la matriz ve la insignia de sucursal en los clientes de sucursal", async ({ page }) => {
  await login(page, "admin1");
  await page.goto("/dashboard/clientes");
  const fila = page.getByRole("row").filter({ hasText: "Escuela" });
  await expect(fila.getByTestId("branch-badge")).toHaveText("Punto Madero");
  // Los clientes de la matriz no llevan insignia.
  await expect(page.getByRole("row").filter({ hasText: "Colegio" }).getByTestId("branch-badge")).toHaveCount(0);
});

test("frecuentes: crea un producto nuevo desde 'Personalizar' y queda guardado", async ({ page, request }) => {
  await login(page, "puntomadero");
  await page.goto("/dashboard/orders?new=1");
  const pedido = page.getByRole("dialog", { name: "Nuevo pedido" });
  await pedido.getByRole("button", { name: "Personalizar" }).click();

  const frecuentes = page.getByRole("dialog", { name: "Mis frecuentes" });
  await frecuentes.getByLabel("Producto nuevo").fill("Termo grabado");
  await frecuentes.getByRole("button", { name: "Agregar", exact: true }).click();
  await expect(frecuentes.getByRole("button", { name: "Quitar Termo grabado" })).toBeVisible();

  // Duplicado por nombre (sin mayúsculas ni acentos): avisa y no repite.
  await frecuentes.getByLabel("Producto nuevo").fill("TERMO  grabado");
  await frecuentes.getByRole("button", { name: "Agregar", exact: true }).click();
  await expect(frecuentes.getByRole("alert")).toContainText("ya está en tus frecuentes");

  // Error del backend.
  await frecuentes.getByLabel("Producto nuevo").fill("Prohibido");
  await frecuentes.getByRole("button", { name: "Agregar", exact: true }).click();
  await expect(frecuentes.getByRole("alert")).toContainText("Ese nombre de producto no está permitido");

  // Se puede quitar, reordenar y guardar.
  await frecuentes.getByLabel("Producto nuevo").fill("Gorra");
  await frecuentes.getByRole("button", { name: "Agregar", exact: true }).click();
  await expect(frecuentes.getByRole("button", { name: "Mover Gorra" })).toBeVisible();
  await frecuentes.getByRole("button", { name: "Quitar Gorra" }).click();
  await frecuentes.getByRole("button", { name: "Guardar" }).click();

  expect((await (await request.get(`${MOCK_API}/__e2e/presets`)).json()).map((p: { name: string }) => p.name)).toEqual([
    "Termo grabado",
    "Gorra",
  ]);
  await expect.poll(async () => (await (await request.get(`${MOCK_API}/__e2e/preferences`)).json()).frequentProductIds).toEqual([1]);
  // El frecuente nuevo ya está disponible para agregarlo al pedido.
  await expect(pedido.getByRole("button", { name: /^Agregar Termo grabado/ })).toBeVisible();
});

test("frecuentes: la matriz (Recepción) también crea productos nuevos", async ({ page, request }) => {
  await login(page);
  await page.goto("/dashboard/orders?new=1");
  const pedido = page.getByRole("dialog", { name: "Nuevo pedido" });
  await pedido.getByRole("button", { name: "Personalizar" }).click();
  const frecuentes = page.getByRole("dialog", { name: "Mis frecuentes" });
  await frecuentes.getByLabel("Producto nuevo").fill("Mandil");
  await frecuentes.getByLabel("Producto nuevo").press("Enter");
  await expect(frecuentes.getByRole("button", { name: "Quitar Mandil" })).toBeVisible();
  await frecuentes.getByRole("button", { name: "Guardar" }).click();
  await expect.poll(async () => (await (await request.get(`${MOCK_API}/__e2e/presets`)).json()).length).toBe(1);
});

test("el detalle de un pedido como sucursal no pide la hoja de materiales (sin 403 ni aviso de error)", async ({ page, request }) => {
  await login(page, "puntomadero");
  await page.goto("/dashboard/orders?openOrderId=110");

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Producción" })).toBeVisible();
  // El panel de insumos no existe para la sucursal, y el backend nunca recibió la petición.
  await expect(dialog.getByRole("region", { name: "Origen de insumos por área" })).toHaveCount(0);
  await page.waitForTimeout(1_000);
  expect((await (await request.get(`${MOCK_API}/__e2e/area-supplies-sucursal`)).json()).pedidas).toBe(0);
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
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
