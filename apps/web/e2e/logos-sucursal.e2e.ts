import { deflateSync } from "node:zlib";
import path from "node:path";
import type { Locator, Page } from "@playwright/test";
import { expect, login, test } from "./helpers";

/**
 * Logo de la sucursal en los pedidos que genera: el admin sube dos versiones
 * (negra para fondos claros, blanca para oscuros) en Usuarios → Sucursales y
 * Recepción, Producción y la tele las ven donde aparece el pedido. En la matriz
 * un filtro "Origen" separa Matriz / sucursales.
 *
 * Con `LOGO_SHOTS_DIR` además guarda capturas (claro y oscuro) para revisarlas.
 */

const MOCK_API = `http://localhost:${process.env.MOCK_API_PORT ?? 4010}`;
const FIXTURES = path.join(__dirname, "fixtures");
const NEGRO = path.join(FIXTURES, "talamas-negro.png");
const BLANCO = path.join(FIXTURES, "talamas-blanco.png");
const SHOTS = process.env.LOGO_SHOTS_DIR;

// La llegada del Modo TV es 3D (three.js): WebGL por software, como en tareas-tv.
test.use({
  launchOptions: {
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {}),
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  },
});

test.beforeEach(async ({ request }) => {
  await request.post(`${MOCK_API}/__e2e/reset-branches`);
  await request.post(`${MOCK_API}/__e2e/reset-tareas`);
  await request.post(`${MOCK_API}/__e2e/seed-logo-fixtures`);
  await request.post(`${MOCK_API}/__e2e/reset-orders-queries`);
});

test.afterAll(async ({ request }) => {
  await request.post(`${MOCK_API}/__e2e/reset-logos`);
  await request.post(`${MOCK_API}/__e2e/reset-tareas`);
});

const conLogos = async (request: import("@playwright/test").APIRequestContext, branchId = 1) => {
  await request.post(`${MOCK_API}/__e2e/seed-logos`, { data: { branchId } });
};

async function modoOscuro(page: Page) {
  await page.addInitScript(() => localStorage.setItem("theme", "dark"));
}

async function captura(target: Page | Locator, nombre: string) {
  if (SHOTS) await target.screenshot({ path: path.join(SHOTS, `${nombre}.png`) });
}

/** La imagen visible cargó de verdad (data URL decodificada). */
async function cargada(img: Locator) {
  await expect(img).toBeVisible();
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
}

/** Las <img> del logo que se VEN (la otra variante queda con display:none). */
const logoVisible = (scope: Page | Locator) => scope.getByTestId("branch-logo").locator("img:visible");
const srcCorto = (img: Locator) => img.evaluate((el: HTMLImageElement) => el.src.slice(0, 40));

/** PNG liso de w×h (para probar el límite de medidas sin pesar nada). */
function pngLiso(w: number, h: number): Buffer {
  const tabla = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b: Buffer) => {
    let c = 0xffffffff;
    for (const x of b) c = tabla[(c ^ x) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (tipo: string, datos: Buffer) => {
    const cuerpo = Buffer.concat([Buffer.from(tipo, "ascii"), datos]);
    const largo = Buffer.alloc(4);
    largo.writeUInt32BE(datos.length);
    const suma = Buffer.alloc(4);
    suma.writeUInt32BE(crc(cuerpo));
    return Buffer.concat([largo, cuerpo, suma]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 0, 0, 0, 0], 8); // 8 bits, gris
  const filas = Buffer.alloc(h * (1 + w), 0x80);
  for (let y = 0; y < h; y++) filas[y * (1 + w)] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(filas)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

test("1 · el admin sube, valida y quita los dos logos de Punto Madero", async ({ page, request }) => {
  await login(page, "admin1");
  await page.goto("/dashboard/usuarios?tab=sucursales");
  const sucursal = page.getByRole("region", { name: "Sucursal Punto Madero" });
  await expect(sucursal).toBeVisible();
  await expect(sucursal.getByText("Logo para fondos claros (negro)")).toBeVisible();
  await expect(sucursal.getByText("Logo para fondos oscuros (blanco)")).toBeVisible();
  await expect(sucursal.getByText("Sin logo")).toHaveCount(2);

  // Validaciones del cliente, sin llegar al backend.
  const claro = sucursal.getByLabel("Logo para fondos claros (negro) de Punto Madero");
  await claro.setInputFiles({ name: "logo.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>") });
  await expect(sucursal.getByRole("alert")).toContainText("El SVG no está permitido");
  await claro.setInputFiles({ name: "enorme.png", mimeType: "image/png", buffer: Buffer.alloc(450 * 1024) });
  await expect(sucursal.getByRole("alert")).toContainText("máximo es 400 KB");
  await claro.setInputFiles({ name: "gigante.png", mimeType: "image/png", buffer: pngLiso(2001, 4) });
  await expect(sucursal.getByRole("alert")).toContainText("2000×2000");
  expect(await (await request.get(`${MOCK_API}/__e2e/logos`)).json()).toEqual({});

  // Los dos logos reales (negro para fondos claros, blanco para oscuros).
  await claro.setInputFiles(NEGRO);
  await cargada(sucursal.getByTestId("logo-preview-onLight").locator("img"));
  await expect(sucursal.getByRole("alert")).toHaveCount(0);
  await sucursal.getByLabel("Logo para fondos oscuros (blanco) de Punto Madero").setInputFiles(BLANCO);
  await cargada(sucursal.getByTestId("logo-preview-onDark").locator("img"));
  expect(await (await request.get(`${MOCK_API}/__e2e/logos`)).json()).toEqual({ 1: { onLight: true, onDark: true } });
  await captura(sucursal, "admin-sucursal-logos-claro");

  // Quitar el negro.
  await sucursal.getByRole("button", { name: /^Quitar logo para fondos claros/ }).click();
  await expect(sucursal.getByTestId("logo-preview-onLight")).toContainText("Sin logo");
  expect(await (await request.get(`${MOCK_API}/__e2e/logos`)).json()).toEqual({ 1: { onLight: false, onDark: true } });
});

test("2 · Recepción ve el logo en la lista, el detalle y la hoja de un pedido de sucursal, y no en uno de matriz", async ({ page, request }) => {
  await conLogos(request);
  await login(page, "recepcion1");
  await page.goto("/dashboard/orders");

  const sucursal = page.getByRole("button", { name: "Ver detalle del pedido #111 de Escuela Madero" });
  const matriz = page.getByRole("button", { name: "Ver detalle del pedido #101 de Colegio San Marcos" });
  await expect(sucursal).toBeVisible();
  await expect(matriz).toBeVisible();

  // Lista: el logo va dentro de la tarjeta del pedido de sucursal (tema claro = el negro).
  const tarjeta = page.locator("article").filter({ has: sucursal });
  const logo = logoVisible(tarjeta);
  await expect(logo).toHaveCount(1);
  await expect(logo).toHaveAttribute("alt", "Punto Madero");
  await cargada(logo);
  expect(await srcCorto(logo)).toContain("data:image/png;base64");
  expect(await logo.evaluate((el: HTMLImageElement) => el.dataset.variant)).toBe("light");
  // Sin saltos de layout: alto fijo.
  expect((await logo.boundingBox())!.height).toBe(24);
  // El de la matriz no lleva logo ni badge.
  const tarjetaMatriz = page.locator("article").filter({ has: matriz });
  await expect(tarjetaMatriz.getByTestId("branch-logo")).toHaveCount(0);
  await expect(tarjetaMatriz.getByTestId("branch-badge")).toHaveCount(0);
  await captura(page, "recepcion-lista-claro");

  // Detalle: encabezado grande y hoja de autorización.
  await sucursal.click();
  const detalle = page.getByRole("dialog", { name: /#111/ });
  await expect(detalle).toBeVisible();
  const hoja = detalle.getByRole("region", { name: "Hoja de autorización" });
  await expect(hoja).toBeVisible();
  await expect(hoja).toContainText("Autorizada");
  await cargada(logoVisible(hoja));
  await expect(logoVisible(hoja)).toHaveAttribute("alt", "Punto Madero");
  const encabezado = logoVisible(detalle.locator("header").first());
  await expect(encabezado).toHaveCount(1);
  await cargada(encabezado);
  expect((await encabezado.boundingBox())!.height).toBe(48);
  await captura(page, "recepcion-detalle-claro");
  await captura(hoja, "recepcion-hoja-claro");
  await page.keyboard.press("Escape");

  // El pedido de la matriz no lleva logo en el detalle.
  await matriz.click();
  const detalleMatriz = page.getByRole("dialog", { name: /#101/ });
  await expect(detalleMatriz).toBeVisible();
  await expect(detalleMatriz.getByRole("region", { name: "Hoja de autorización" })).toBeVisible();
  await expect(detalleMatriz.getByTestId("branch-logo")).toHaveCount(0);
  await expect(detalleMatriz.getByTestId("branch-badge")).toHaveCount(0);
});

test("2b · en tema oscuro se ve el logo BLANCO", async ({ page, request }) => {
  await conLogos(request);
  await modoOscuro(page);
  await login(page, "recepcion1");
  await page.goto("/dashboard/orders");
  await expect(page.locator("html")).toHaveClass(/dark/);

  const tarjeta = page.locator("article").filter({ has: page.getByRole("button", { name: /pedido #111/ }) });
  const logo = logoVisible(tarjeta);
  await cargada(logo);
  expect(await logo.evaluate((el: HTMLImageElement) => el.dataset.variant)).toBe("dark");
  await captura(page, "recepcion-lista-oscuro");

  await page.getByRole("button", { name: /Ver detalle del pedido #111/ }).click();
  const detalle = page.getByRole("dialog", { name: /#111/ });
  const hoja = detalle.getByRole("region", { name: "Hoja de autorización" });
  await expect(hoja).toBeVisible();
  await cargada(logoVisible(hoja));
  expect(await logoVisible(hoja).evaluate((el: HTMLImageElement) => el.dataset.variant)).toBe("dark");
  await captura(page, "recepcion-detalle-oscuro");
});

test("2c · sin logo cargado, el pedido de sucursal muestra el nombre", async ({ page }) => {
  await login(page, "recepcion1");
  await page.goto("/dashboard/orders");
  const tarjeta = page.locator("article").filter({ has: page.getByRole("button", { name: /pedido #111/ }) });
  await expect(tarjeta.getByTestId("branch-badge")).toHaveText("Punto Madero");
  await expect(tarjeta.getByTestId("branch-logo")).toHaveCount(0);
});

test("3 · el filtro Origen separa Matriz / sucursales, va a la URL y al backend", async ({ page, request }) => {
  await conLogos(request);
  await login(page, "recepcion1");
  await page.goto("/dashboard/orders");

  const origen = page.getByRole("combobox", { name: "Origen" });
  const tarjeta = (n: number) => page.getByRole("button", { name: new RegExp(`Ver detalle del pedido #${n} `) });
  await expect(origen).toHaveText(/Todos/);
  for (const n of [101, 102, 111, 112]) await expect(tarjeta(n)).toBeVisible();

  const elegir = async (nombre: string) => {
    await origen.click();
    await page.getByRole("option", { name: nombre, exact: true }).click();
  };

  await elegir("Matriz");
  await expect(tarjeta(111)).toHaveCount(0);
  await expect(tarjeta(112)).toHaveCount(0);
  await expect(tarjeta(101)).toBeVisible();
  await expect(page).toHaveURL(/origen=matriz/);

  await elegir("Todas las sucursales");
  await expect(tarjeta(101)).toHaveCount(0);
  await expect(tarjeta(111)).toBeVisible();
  await expect(tarjeta(112)).toBeVisible();
  await expect(page).toHaveURL(/origen=sucursal/);
  await captura(page, "recepcion-origen-sucursales");

  await elegir("Plaza Norte");
  await expect(tarjeta(111)).toHaveCount(0);
  await expect(tarjeta(112)).toBeVisible();
  await expect(page).toHaveURL(/origen=2/);

  // Se recuerda al recargar.
  await page.reload();
  await expect(origen).toHaveText(/Plaza Norte/);
  await expect(tarjeta(112)).toBeVisible();
  await expect(tarjeta(101)).toHaveCount(0);

  // Y en el tablero (cuadrícula) rige el mismo filtro.
  await page.getByRole("radiogroup", { name: "Vista" }).getByRole("radio", { name: "Cuadrícula" }).click();
  await expect(page.getByRole("button", { name: /#112/ }).first()).toBeVisible();
  await expect(page.getByText("Colegio San Marcos")).toHaveCount(0);

  // El backend recibió branchId / origin (el filtrado lo hace él).
  const consultas: string[] = await (await request.get(`${MOCK_API}/__e2e/orders-queries`)).json();
  expect(consultas).toEqual(expect.arrayContaining(["", "?origin=matriz", "?origin=sucursal", "?branchId=2"]));

  // Limpiar vuelve a Todos y quita el parámetro.
  await page.getByRole("button", { name: "Limpiar", exact: true }).click();
  await expect(origen).toHaveText(/Todos/);
  await expect(page).not.toHaveURL(/origen=/);
});

test("3b · el historial de matriz también filtra por Origen", async ({ page, request }) => {
  await conLogos(request);
  await login(page, "recepcion1");
  await page.goto("/dashboard/historial");
  await expect(page.getByRole("button", { name: /Ver pedido #111/ })).toBeVisible();
  // Junto al cliente: el logo del pedido de sucursal, no el de matriz.
  await cargada(logoVisible(page.getByRole("button", { name: /Ver pedido #111/ })));
  await expect(page.getByRole("button", { name: /Ver pedido #101/ }).getByTestId("branch-logo")).toHaveCount(0);
  await captura(page, "historial-matriz-claro");

  await page.getByRole("combobox", { name: "Origen" }).click();
  await page.getByRole("option", { name: "Matriz", exact: true }).click();
  await expect(page.getByRole("button", { name: /Ver pedido #111/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Ver pedido #101/ })).toBeVisible();
  await expect(page).toHaveURL(/origen=matriz/);
});

test("4 · tarea en la bandeja y en el Modo TV: la tele usa el logo BLANCO", async ({ page, request }) => {
  await conLogos(request);
  await login(page, "jeguia1");
  await page.goto("/dashboard/tareas");

  // Bandeja (fondo de tarjeta según el tema): tema claro = logo negro.
  const bandeja = page.locator("article").filter({ has: page.getByRole("button", { name: /Ver pedido #111/ }) });
  await expect(bandeja).toBeVisible();
  await cargada(logoVisible(bandeja));
  expect(await logoVisible(bandeja).evaluate((el: HTMLImageElement) => el.dataset.variant)).toBe("light");
  await captura(page, "tareas-bandeja-claro");

  // Modo TV: fondo oscuro fijo → logo blanco, aunque la interfaz esté en tema claro.
  await page.getByRole("button", { name: "Modo TV" }).click();
  const tele = page.getByRole("dialog", { name: "Tareas del área" });
  const tarjeta = tele.getByRole("article", { name: /Pedido #111/ });
  await expect(tarjeta).toBeVisible();
  const logo = logoVisible(tarjeta);
  await expect(logo).toHaveCount(1);
  await cargada(logo);
  expect(await logo.evaluate((el: HTMLImageElement) => el.dataset.variant)).toBe("dark");
  expect(await tarjeta.getByTestId("branch-logo").getAttribute("data-surface")).toBe("dark");
  // Las tarjetas de pedidos de matriz de la tele no llevan logo.
  await expect(tele.getByRole("article", { name: /Pedido #105/ }).getByTestId("branch-logo")).toHaveCount(0);
  await captura(page, "tele-claro");
  await page.keyboard.press("Escape");
});

test("4b · el ticket animado de llegada lleva el logo (papel claro → versión negra)", async ({ page, request }) => {
  await conLogos(request);
  // 2D (movimiento reducido): el ticket es DOM visible. El 3D copia ese mismo DOM a la textura.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await login(page, "jeguia1");
  await page.goto("/dashboard/tareas?tv=1&demo=1");
  const tele = page.getByRole("dialog", { name: "Tareas del área" });
  await expect(tele).toBeVisible();

  await tele.getByRole("button", { name: "Simular a tiempo" }).click(); // #9001 (impar → sucursal)
  const aviso = page.getByRole("status").filter({ hasText: /Nuevo pedido #9001/ });
  await expect(aviso).toBeAttached();
  const ticketLogo = aviso.getByTestId("branch-logo");
  await expect(ticketLogo.first()).toBeAttached();
  expect(await ticketLogo.first().getAttribute("data-surface")).toBe("light");
  await expect(ticketLogo.locator("img").first()).toHaveAttribute("data-variant", "light");
  await expect.poll(() => ticketLogo.locator("img").first().evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  if (SHOTS) {
    // El ticket sólo está unos segundos: se captura en cuanto es visible.
    await aviso.screenshot({ path: path.join(SHOTS, "tele-ticket-llegada.png") }).catch(() => undefined);
  }
  // Al terminar queda la tarjeta con el logo blanco.
  const nueva = tele.getByRole("region", { name: "Pendiente", exact: true }).getByRole("article", { name: /Pedido #9001/ });
  await expect(nueva).toBeVisible({ timeout: 12_000 });
  await expect(nueva.getByTestId("branch-logo").locator("img")).toHaveAttribute("data-variant", "dark");
});

test("5 · la cuenta de sucursal sólo ve SUS pedidos, con su logo y sin filtro Origen", async ({ page, request }) => {
  await conLogos(request, 1);
  await conLogos(request, 2);
  await login(page, "puntomadero");
  await expect(page).toHaveURL(/\/dashboard\/orders/);

  await expect(page.getByRole("button", { name: /Ver detalle del pedido #111/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Ver detalle del pedido #110/ })).toBeVisible();
  // Ni la matriz ni otra sucursal.
  for (const ajeno of [101, 102, 112]) {
    await expect(page.getByRole("button", { name: new RegExp(`pedido #${ajeno}`) })).toHaveCount(0);
  }
  await expect(page.getByRole("combobox", { name: "Origen" })).toHaveCount(0);
  await expect(page.getByRole("img", { name: "Plaza Norte" })).toHaveCount(0);
  await cargada(logoVisible(page.locator("article").filter({ has: page.getByRole("button", { name: /pedido #111/ }) })));
  await captura(page, "sucursal-lista-claro");

  // El historial propio también lleva su logo.
  await page.goto("/dashboard/mi-historial");
  const fila = page.getByRole("button", { name: /Ver pedido #111/ });
  await cargada(logoVisible(fila));
  await captura(page, "sucursal-historial-claro");
});
