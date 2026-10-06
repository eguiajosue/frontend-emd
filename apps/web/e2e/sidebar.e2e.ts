import { expect, test, login } from "./helpers";

/**
 * Barra lateral personalizable (docs/plans/sidebar-y-mockups-v2.md, lane B):
 * favoritos, ocultos y barra expandida editados desde Configuración, guardados
 * en `navPreferences` del backend de mentira y reflejados en el riel.
 */

const MOCK_API = `http://localhost:${process.env.MOCK_API_PORT ?? 4010}`;

test.beforeEach(async ({ request }) => {
  await request.post(`${MOCK_API}/__e2e/reset-preferences`);
});

test("fijar un favorito desde Configuración lo pone arriba en la barra", async ({ page, request }) => {
  await login(page);
  await page.goto("/dashboard/configuracion");

  const rail = page.getByRole("navigation", { name: "Secciones" });
  await expect(rail.getByRole("list", { name: "Favoritos" })).toHaveCount(0);

  const section = page.locator("#barra-lateral");
  await section
    .getByRole("list", { name: "Compras y clientes" })
    .getByRole("button", { name: "Agregar a favoritos: Clientes" })
    .click();

  // Aparece en Favoritos (arriba) y ya no se repite en su grupo.
  const favorites = rail.getByRole("list", { name: "Favoritos" });
  await expect(favorites.getByRole("link", { name: "Clientes" })).toBeVisible();
  await expect(rail.getByRole("link", { name: "Clientes" })).toHaveCount(1);
  await expect(section.getByRole("list", { name: "Favoritos" }).getByText("Clientes")).toBeVisible();

  // Quedó guardado con la forma que acepta el backend.
  await expect
    .poll(async () => (await (await request.get(`${MOCK_API}/users/me/preferences`)).json()).navPreferences)
    .toEqual({ favorites: ["/dashboard/clientes"], order: [], hidden: [], expanded: false });

  // Sobrevive a recargar la página.
  await page.reload();
  await expect(
    page.getByRole("navigation", { name: "Secciones" }).getByRole("list", { name: "Favoritos" }).getByRole("link", { name: "Clientes" })
  ).toBeVisible();
});

test("ocultar quita el ítem de la barra pero la pantalla sigue accesible", async ({ page }) => {
  await login(page);
  await page.goto("/dashboard/configuracion");
  await page.locator("#barra-lateral").getByRole("button", { name: "Ocultar de la barra: Historial" }).click();

  const rail = page.getByRole("navigation", { name: "Secciones" });
  await expect(rail.getByRole("link", { name: "Historial" })).toHaveCount(0);

  await page.goto("/dashboard/historial");
  await expect(page).toHaveURL(/\/dashboard\/historial/);
  await expect(page.getByRole("navigation", { name: "Secciones" }).getByRole("link", { name: "Historial" })).toHaveCount(0);
});

test("el botón Expandir muestra los títulos y el contenido se recorre", async ({ page }) => {
  await login(page);
  await page.goto("/dashboard/configuracion");
  const main = page.locator("main");
  await expect(main).toHaveAttribute("data-rail", "collapsed");

  const aside = page.getByRole("complementary", { name: "Navegación principal" });
  await expect(aside.getByText("Pedidos", { exact: true })).toHaveCount(0);

  await aside.getByRole("button", { name: "Expandir barra lateral" }).click();
  await expect(main).toHaveAttribute("data-rail", "expanded");
  await expect(aside.getByText("Pedidos", { exact: true })).toBeVisible();
  await expect(aside.getByRole("button", { name: "Compras y clientes" })).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("switch", { name: "Mostrar títulos (barra expandida)" })).toBeChecked();

  // El contenido no queda debajo del riel.
  await expect
    .poll(async () => {
      const railBox = await aside.boundingBox();
      const titleBox = await page.getByRole("heading", { level: 1, name: "Configuración" }).boundingBox();
      return railBox && titleBox ? titleBox.x - (railBox.x + railBox.width) : -1;
    })
    .toBeGreaterThan(0);

  // Recargar conserva la barra expandida.
  await page.reload();
  await expect(page.locator("main")).toHaveAttribute("data-rail", "expanded");
  await expect(
    page.getByRole("complementary", { name: "Navegación principal" }).getByText("Pedidos", { exact: true })
  ).toBeVisible();

  await page.getByRole("button", { name: "Contraer barra lateral" }).click();
  await expect(page.locator("main")).toHaveAttribute("data-rail", "collapsed");
});
