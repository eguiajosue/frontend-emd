import { deflateSync } from "node:zlib";
import { expect, test } from "@playwright/test";
import { login } from "./helpers";

/**
 * Estudio de mockups 3D (docs/plans/mockups-3d.md, R4): el flujo de Recepción
 * de punta a punta en un navegador de verdad, con WebGL incluido. Los unit
 * tests mockean el lienzo; aquí se dibuja la prenda, se exporta la lámina y se
 * manda al backend de mentira.
 */

const MOCK_API = `http://localhost:${process.env.MOCK_API_PORT ?? 4010}`;

// Chromium headless no tiene GPU: WebGL sale por SwiftShader (por software).
// Se repite el ejecutable del proyecto porque `launchOptions` se reemplaza
// entero, no se mezcla con el de playwright.config.ts.
test.use({
  launchOptions: {
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {}),
    args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
  },
});

/** PNG RGBA de `size`×`size`: un cuadrado de color con borde transparente. */
function tinyPng(size = 32): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc32 = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 6; // RGBA
  const rows: Buffer[] = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4); // filtro 0 + píxeles
    for (let x = 0; x < size; x++) {
      const inside = x >= 4 && y >= 4 && x < size - 4 && y < size - 4;
      row.set(inside ? [220, 38, 38, 255] : [0, 0, 0, 0], 1 + x * 4);
    }
    rows.push(row);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

test.beforeEach(async ({ request }) => {
  await request.post(`${MOCK_API}/__e2e/reset`);
});

test("1 · Recepción arma un mockup, lo descarga y lo adjunta a un pedido", async ({ page, request }) => {
  // WebGL por software: cargar la prenda y renderizar la lámina (3 vistas)
  // tarda bastante más que en una máquina con GPU.
  test.setTimeout(180_000);
  await login(page);
  // /dashboard redirige al inicio del rol: esperar a que termine, si no esa
  // redirección le gana al clic del menú.
  await expect(page).toHaveURL(/\/dashboard\/inicio/, { timeout: 30_000 });

  // Se llega desde el menú.
  const nav = page.getByRole("complementary", { name: "Navegación principal" });
  await nav.getByRole("link", { name: "Mockups", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/mockups/);

  // El lienzo 3D (no el aviso de "sin WebGL") y la prenda ya cargada.
  const lienzo = page.getByRole("img", { name: "Vista 3D de la prenda con los diseños" });
  await expect(lienzo).toBeVisible({ timeout: 30_000 });
  await expect(lienzo.locator("canvas")).toBeVisible();
  await expect(page.getByText("Tu navegador no puede mostrar 3D")).toHaveCount(0);
  await expect(lienzo.getByText("Cargando prenda…")).toHaveCount(0, { timeout: 30_000 });

  // Subir el diseño: aparece en "Diseños" y queda seleccionado.
  await page.getByLabel("Subir diseño").setInputFiles({
    name: "logo-cliente.png",
    mimeType: "image/png",
    buffer: tinyPng(),
  });
  const disenos = page.getByRole("list", { name: "Diseños del mockup" });
  await expect(disenos.getByRole("listitem")).toHaveCount(1);
  await expect(disenos.getByRole("button", { name: /Seleccionar logo-cliente/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // Preset de posición: queda marcado y lleva a la vista que corresponde.
  const presets = page.getByRole("group", { name: "Posiciones predeterminadas" });
  const pecho = presets.getByRole("button", { name: "Pecho izquierdo" });
  await pecho.click();
  await expect(pecho).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("group", { name: "Vista" }).getByRole("button", { name: "Frente" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // Cambiar a gorra y volver a playera; el diseño se conserva.
  const prenda = page.getByRole("radiogroup", { name: "Prenda" });
  await prenda.getByRole("radio", { name: "Gorra" }).click();
  await expect(prenda.getByRole("radio", { name: "Gorra" })).toHaveAttribute("aria-checked", "true");
  await expect(presets.getByRole("button", { name: "Lateral izquierdo" })).toBeVisible();
  await expect(lienzo.getByText("Cargando prenda…")).toHaveCount(0, { timeout: 30_000 });
  await prenda.getByRole("radio", { name: "Playera" }).click();
  await expect(prenda.getByRole("radio", { name: "Playera" })).toHaveAttribute("aria-checked", "true");
  await expect(presets.getByRole("button", { name: "Pecho izquierdo" })).toBeVisible();
  await expect(disenos.getByRole("listitem")).toHaveCount(1);
  await expect(lienzo.getByText("Cargando prenda…")).toHaveCount(0, { timeout: 30_000 });

  // Descargar la lámina PNG.
  const [descarga] = await Promise.all([
    page.waitForEvent("download", { timeout: 60_000 }),
    page.getByRole("button", { name: "Descargar imagen" }).click(),
  ]);
  expect(descarga.suggestedFilename()).toMatch(/^mockup-.*\.png$/);
  expect(await descarga.failure()).toBeNull();

  // Adjuntar a un pedido elegido de la lista.
  await page.getByRole("button", { name: "Adjuntar a pedido" }).click();
  const dialogo = page.getByRole("dialog", { name: "Adjuntar a pedido" });
  await expect(dialogo).toBeVisible({ timeout: 60_000 });
  await dialogo
    .getByRole("list", { name: "Pedidos" })
    .getByRole("button", { name: /#101.*Colegio San Marcos/ })
    .click();
  await expect(page.getByText("Mockup adjuntado al pedido #101")).toBeVisible({ timeout: 30_000 });
  await expect(dialogo).toBeHidden();

  // Lo que recibió el backend: la prenda, la lámina PNG y la configuración.
  const recibidos = (await (await request.get(`${MOCK_API}/__e2e/mockups`)).json()) as Array<{
    orderId: number;
    garment: string;
    imageDataUrl: string;
    config: { garment: string; layers: Array<{ name: string }> };
  }>;
  expect(recibidos).toHaveLength(1);
  expect(recibidos[0].orderId).toBe(101);
  expect(recibidos[0].garment).toBe("tshirt");
  expect(recibidos[0].imageDataUrl).toMatch(/^data:image\/png;base64,.{100,}/);
  expect(recibidos[0].config.garment).toBe("tshirt");
  expect(recibidos[0].config.layers).toHaveLength(1);
});

test("2 · un rol de producción (bordado) no ve Mockups en el menú", async ({ page }) => {
  await login(page, "bordado");

  const nav = page.getByRole("complementary", { name: "Navegación principal" });
  // El menú ya se pintó (su bandeja de tareas está), y Mockups no.
  await expect(nav.getByRole("link", { name: "Tareas asignadas" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("link", { name: "Mockups", exact: true })).toHaveCount(0);
});

test("3 · Mis colores, plantilla guardada y aplicada, y bandera de México como diseño", async ({ page, request }) => {
  test.setTimeout(180_000);
  await login(page);
  await expect(page).toHaveURL(/\/dashboard\/inicio/, { timeout: 30_000 });
  await page.goto("/dashboard/mockups");

  const lienzo = page.getByRole("img", { name: "Vista 3D de la prenda con los diseños" });
  await expect(lienzo.locator("canvas")).toBeVisible({ timeout: 30_000 });
  await expect(lienzo.getByText("Cargando prenda…")).toHaveCount(0, { timeout: 30_000 });

  // Mis colores: agregar un verde propio; se aplica y queda guardado para este usuario.
  await page.getByRole("button", { name: "Color de la prenda: agregar color" }).click();
  const hexNuevo = page.getByRole("textbox", { name: "Color nuevo (código hex)" });
  await hexNuevo.fill("1f7a4d");
  await hexNuevo.press("Enter");
  await page.getByRole("button", { name: "Agregar", exact: true }).click();
  await page.keyboard.press("Escape");
  const misColores = page.getByRole("group", { name: "Color de la prenda: mis colores" });
  await expect(misColores.getByRole("button", { name: "Color de la prenda: #1F7A4D" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("textbox", { name: "Color de la prenda (código hex)" })).toHaveValue("#1F7A4D");
  await expect
    .poll(async () => (await (await request.get(`${MOCK_API}/__e2e/preferences`)).json()).mockupColors)
    .toEqual({ favorites: [], custom: ["#1f7a4d"] });

  // Biblioteca → Banderas: buscar "méx" y agregar la de México como diseño.
  await page.getByRole("button", { name: "Biblioteca", exact: true }).click();
  const biblioteca = page.getByRole("dialog", { name: "Biblioteca" });
  await biblioteca.getByRole("tab", { name: "Banderas" }).click();
  const banderas = biblioteca.getByRole("list", { name: "Banderas" });
  await expect(banderas.getByRole("button").first()).toHaveAccessibleName("Agregar bandera de México");
  await biblioteca.getByRole("searchbox", { name: "Buscar país" }).fill("méx");
  await banderas.getByRole("button", { name: "Agregar bandera de México" }).click();
  await expect(biblioteca).toBeHidden({ timeout: 30_000 });
  const disenos = page.getByRole("list", { name: "Diseños del mockup" });
  await expect(disenos.getByRole("button", { name: "Seleccionar Bandera de México" })).toHaveAttribute("aria-pressed", "true");

  // Guardar como plantilla (miniatura del frente, JPEG chico).
  await page.getByRole("button", { name: "Guardar como plantilla" }).click();
  const guardar = page.getByRole("dialog", { name: "Guardar como plantilla" });
  await guardar.getByRole("textbox", { name: "Nombre de la plantilla" }).fill("Uniforme México");
  await guardar.getByRole("button", { name: "Guardar plantilla" }).click();
  await expect(page.getByText("Plantilla «Uniforme México» guardada")).toBeVisible({ timeout: 60_000 });
  const guardadas = (await (await request.get(`${MOCK_API}/__e2e/mockup-templates`)).json()) as Array<{
    name: string;
    garment: string;
    thumbnailUrl: string;
    config: { colors: { body: string }; layers: Array<{ name: string }> };
  }>;
  expect(guardadas).toHaveLength(1);
  expect(guardadas[0]).toMatchObject({ name: "Uniforme México", garment: "tshirt" });
  expect(guardadas[0].config.colors.body).toBe("#1f7a4d");
  expect(guardadas[0].config.layers.map((l) => l.name)).toEqual(["Bandera de México"]);
  expect(guardadas[0].thumbnailUrl).toMatch(/^data:image\/jpeg;base64,/);
  expect(guardadas[0].thumbnailUrl.length).toBeLessThan(96 * 1024 * 1.4);

  // Cambiar a gorra en negro y volver a la plantilla: pide confirmar y la restaura.
  const prenda = page.getByRole("radiogroup", { name: "Prenda" });
  await prenda.getByRole("radio", { name: "Gorra" }).click();
  await expect(lienzo.getByText("Cargando prenda…")).toHaveCount(0, { timeout: 30_000 });
  await page.getByRole("button", { name: "Plantillas", exact: true }).click();
  const plantillas = page.getByRole("dialog", { name: "Plantillas" });
  await plantillas.getByRole("button", { name: "Usar plantilla Uniforme México" }).click();
  const confirmar = page.getByRole("alertdialog", { name: "¿Reemplazar el mockup actual?" });
  await confirmar.getByRole("button", { name: "Usar plantilla" }).click();
  await expect(page.getByText("Plantilla «Uniforme México» aplicada")).toBeVisible();
  await expect(prenda.getByRole("radio", { name: "Playera" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("textbox", { name: "Color de la prenda (código hex)" })).toHaveValue("#1F7A4D");
  await expect(disenos.getByRole("listitem")).toHaveCount(1);
  await expect(disenos.getByRole("button", { name: "Seleccionar Bandera de México" })).toBeVisible();
  await expect(lienzo.getByText("Cargando prenda…")).toHaveCount(0, { timeout: 30_000 });
});
