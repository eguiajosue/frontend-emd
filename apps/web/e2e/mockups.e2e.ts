import { readFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { expect, test, login } from "./helpers";

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
type Pixel = [number, number, number, number];
function tinyPng(size = 32, pixel?: (x: number, y: number) => Pixel): Buffer {
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
      row.set(pixel ? pixel(x, y) : inside ? [220, 38, 38, 255] : [0, 0, 0, 0], 1 + x * 4);
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

  // Una sola vista: menú junto al botón; baja una imagen cuadrada y con el nombre de la vista.
  await page.getByRole("button", { name: "Elegir la vista a descargar" }).click();
  const [vista] = await Promise.all([
    page.waitForEvent("download", { timeout: 60_000 }),
    page.getByRole("menuitem", { name: /Solo Espalda/ }).click(),
  ]);
  expect(vista.suggestedFilename()).toMatch(/^mockup-.*-espalda\.png$/);
  const archivo = await vista.path();
  expect(archivo).toBeTruthy();
  const png = readFileSync(archivo!);
  // La lámina completa es apaisada (1600 de ancho); una vista sola es cuadrada.
  expect(png.readUInt32BE(16)).toBe(png.readUInt32BE(20));
  expect(png.readUInt32BE(16)).toBeLessThan(1600);

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

/** Logo de prueba: anillo negro con una barra, sobre fondo transparente. */
function ringLogo(): Buffer {
  const S = 160;
  return tinyPng(S, (x, y) => {
    const d = Math.hypot(x - S / 2, y - S / 2);
    const ring = d < 74 && d > 54;
    const bar = Math.abs(x - S / 2) < 60 && Math.abs(y - S / 2) < 12;
    return ring || bar ? [10, 10, 10, 255] : [0, 0, 0, 0];
  });
}

test("4 · termo: el diseño se graba con láser (acero sobre pintura y sobre acero) y taza a color", async ({ page }) => {
  test.setTimeout(240_000);
  const shots = process.env.E2E_SHOTS_DIR;
  const shot = async (name: string) => {
    if (shots) await page.getByRole("img", { name: "Vista 3D de la prenda con los diseños" }).screenshot({ path: `${shots}/${name}.png` });
  };
  await login(page);
  await expect(page).toHaveURL(/\/dashboard\/inicio/, { timeout: 30_000 });
  await page.goto("/dashboard/mockups");
  const lienzo = page.getByRole("img", { name: "Vista 3D de la prenda con los diseños" });
  const cargado = () => expect(lienzo.getByText("Cargando prenda…")).toHaveCount(0, { timeout: 60_000 });
  await expect(lienzo.locator("canvas")).toBeVisible({ timeout: 30_000 });
  await cargado();

  const prenda = page.getByRole("radiogroup", { name: "Prenda" });
  await prenda.getByRole("radio", { name: "Termo" }).click();
  await cargado();
  const host = lienzo.locator("div.absolute").first();
  await expect(host).toHaveAttribute("data-garment", "termo");

  await page.getByLabel("Subir diseño").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: ringLogo() });
  await expect(host).toHaveAttribute("data-engraved-layers", "1");
  const panel = page.getByTestId("laser-engrave-panel");
  await expect(panel).toBeVisible();
  await expect(page.getByTestId("laser-preview")).toBeVisible();
  await page.waitForTimeout(1500);
  await shot("termo-grabado-negro");

  // Ajustes: umbral, invertir y difuminado siguen mostrando el grabado.
  await panel.getByRole("switch", { name: "Invertir grabado" }).click();
  await panel.getByRole("switch", { name: "Difuminado Floyd–Steinberg" }).click();
  await panel.getByRole("button", { name: "Restablecer" }).click();
  await expect(panel.getByRole("switch", { name: "Invertir grabado" })).toHaveAttribute("aria-checked", "false");

  // Otro color y acero natural.
  await page.getByRole("button", { name: "Pintura electrostática" }).click();
  await page.getByRole("textbox", { name: "Color del termo (código hex)" }).fill("1f4fa3");
  await page.getByRole("textbox", { name: "Color del termo (código hex)" }).press("Enter");
  await page.waitForTimeout(1200);
  await shot("termo-grabado-azul");
  await page.getByRole("button", { name: "Acero natural" }).click();
  await page.waitForTimeout(1200);
  await shot("termo-grabado-acero");
  await expect(page.getByText("Sobre acero")).toBeVisible();

  // La lámina se exporta sobre pintura (el grabado plateado resalta más).
  await page.getByRole("button", { name: "Pintura electrostática" }).click();
  await page.waitForTimeout(800);
  // Presets del termo y exportación de la lámina con el efecto.
  await page.getByRole("group", { name: "Posiciones predeterminadas" }).getByRole("button", { name: "Reverso" }).click();
  const [descarga] = await Promise.all([
    page.waitForEvent("download", { timeout: 90_000 }),
    page.getByRole("button", { name: "Descargar imagen" }).click(),
  ]);
  expect(descarga.suggestedFilename()).toMatch(/^mockup-termo-.*\.png$/);
  if (shots) await descarga.saveAs(`${shots}/termo-lamina.png`);

  // Taza: impresión a todo color, sin panel de láser.
  await prenda.getByRole("radio", { name: "Taza" }).click();
  await cargado();
  await expect(host).toHaveAttribute("data-garment", "taza");
  await expect(host).toHaveAttribute("data-engraved-layers", "0");
  await expect(page.getByTestId("laser-engrave-panel")).toHaveCount(0);
  await page.getByLabel("Subir diseño").setInputFiles({ name: "color.png", mimeType: "image/png", buffer: tinyPng(96) });
  const presets = page.getByRole("group", { name: "Posiciones predeterminadas" });
  await expect(presets.getByRole("button", { name: "Alrededor" })).toBeVisible();
  await presets.getByRole("button", { name: "Alrededor" }).click();
  await page.waitForTimeout(1200);
  await shot("taza-alrededor");
  await presets.getByRole("button", { name: "Frente" }).click();
  await page.waitForTimeout(1200);
  await shot("taza-frente");
});

test("5 · Rotulaciones: cada vehículo carga, lleva un logo, cambia de vista, el tráiler por partes, descarga y adjunta", async ({ page, request }) => {
  test.setTimeout(480_000);
  const shots = process.env.E2E_SHOTS_DIR;
  const errores: string[] = [];
  page.on("console", (m) => {
    // El mock de la API no atiende WebSockets (tiempo real de notificaciones): ese ruido
    // crece con la duración del caso y no tiene que ver con el 3D.
    if (m.type() === "error" && !/favicon|404|socket\.io/.test(m.text())) errores.push(m.text());
  });
  page.on("pageerror", (e) => errores.push(e.message));
  await login(page);
  await expect(page).toHaveURL(/\/dashboard\/inicio/, { timeout: 30_000 });
  await page.goto("/dashboard/mockups");
  const lienzo = page.getByRole("img", { name: "Vista 3D de la prenda con los diseños" });
  const cargado = () => expect(lienzo.getByText("Cargando prenda…")).toHaveCount(0, { timeout: 90_000 });
  const host = lienzo.locator("div.absolute").first();
  await expect(lienzo.locator("canvas")).toBeVisible({ timeout: 30_000 });
  await cargado();
  const shot = async (name: string) => {
    if (shots) await page.waitForTimeout(1200), await lienzo.screenshot({ path: `${shots}/${name}.png` });
  };
  const vistas = page.getByRole("group", { name: "Vista" });
  const presets = page.getByRole("group", { name: "Posiciones predeterminadas" });

  // Categoría Rotulaciones: los cinco vehículos, sin tallas ni panel láser.
  await page.getByRole("radiogroup", { name: "Categoría" }).getByRole("radio", { name: "Rotulaciones" }).click();
  const vehiculos = page.getByRole("radiogroup", { name: "Vehículo" });
  await expect(vehiculos.getByRole("radio")).toHaveText([/Carro/, /Minivan/, /Pickup/, /Tráiler/, /Bicicleta/]);
  await cargado();
  await expect(host).toHaveAttribute("data-garment", "car");
  await expect(page.getByRole("button", { name: "Lado izquierdo" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Arriba" })).toBeVisible();
  await expect(page.getByText("Tallas", { exact: true })).toHaveCount(0);

  const casos: [string, string, string, string][] = [
    ["Carro", "car", "Puerta izquierda", "carro"],
    ["Minivan", "minivan", "Puerta corrediza izquierda", "minivan"],
    ["Pickup", "pickup", "Caja – lateral izquierdo", "pickup"],
    ["Bicicleta", "bicycle", "Tubo diagonal izquierdo", "bicicleta"],
  ];
  let primero = true;
  for (const [nombre, id, preset, slug] of casos) {
    await vehiculos.getByRole("radio", { name: nombre }).click();
    await cargado();
    await expect(host).toHaveAttribute("data-garment", id);
    if (primero) {
      await page.getByLabel("Subir diseño").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: ringLogo() });
      primero = false;
    }
    await expect(page.getByRole("list", { name: "Diseños del mockup" }).getByRole("listitem")).toHaveCount(1);
    await presets.getByRole("button", { name: preset }).click();
    await expect(presets.getByRole("button", { name: preset })).toHaveAttribute("aria-pressed", "true");
    await expect(vistas.getByRole("button", { name: "Lado izquierdo" })).toHaveAttribute("aria-pressed", "true");
    await shot(`${slug}-lado`);
    await vistas.getByRole("button", { name: "Frente" }).click();
    await shot(`${slug}-frente`);
  }

  // Tráiler: completo, sólo cabina y sólo caja.
  await vehiculos.getByRole("radio", { name: "Tráiler" }).click();
  await cargado();
  const parte = page.getByRole("radiogroup", { name: "Parte del tráiler" });
  await expect(parte.getByRole("radio", { name: "Completo" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("radiogroup", { name: "Categoría" }).getByRole("radio", { name: "Prendas" }).click();
  await expect(page.getByRole("radiogroup", { name: "Parte del tráiler" })).toHaveCount(0);
  await page.getByRole("radiogroup", { name: "Categoría" }).getByRole("radio", { name: "Rotulaciones" }).click();
  await page.getByRole("radiogroup", { name: "Vehículo" }).getByRole("radio", { name: "Tráiler" }).click();
  await cargado();
  await presets.getByRole("button", { name: "Caja – lateral izquierdo" }).click();
  await shot("trailer-completo-lado");
  await parte.getByRole("radio", { name: "Solo cabina" }).click();
  await cargado();
  await expect(presets.getByRole("button", { name: "Caja – lateral izquierdo" })).toHaveCount(0);
  await expect(presets.getByRole("button", { name: "Cabina – puerta izquierda" })).toBeVisible();
  await shot("trailer-cabina-lado");
  await parte.getByRole("radio", { name: "Solo caja" }).click();
  await cargado();
  await expect(presets.getByRole("button", { name: "Caja – puerta trasera" })).toBeVisible();
  await expect(presets.getByRole("button", { name: "Cabina – puerta izquierda" })).toHaveCount(0);
  await shot("trailer-caja-lado");
  await parte.getByRole("radio", { name: "Completo" }).click();
  await cargado();

  // Una vista y la lámina completa.
  await presets.getByRole("button", { name: "Caja – lateral izquierdo" }).click();
  await page.getByRole("button", { name: "Elegir la vista a descargar" }).click();
  const [lado] = await Promise.all([
    page.waitForEvent("download", { timeout: 120_000 }),
    page.getByRole("menuitem", { name: /Solo Lado izquierdo/ }).click(),
  ]);
  expect(lado.suggestedFilename()).toMatch(/^mockup-trailer-.*-lado-izquierdo\.png$/);
  const pngLado = readFileSync((await lado.path())!);
  expect(pngLado.readUInt32BE(16)).toBeGreaterThan(pngLado.readUInt32BE(20));
  if (shots) await lado.saveAs(`${shots}/lamina-trailer-lado-izquierdo.png`);
  const [lamina] = await Promise.all([
    page.waitForEvent("download", { timeout: 180_000 }),
    page.getByRole("button", { name: "Descargar imagen" }).click(),
  ]);
  const pngLamina = readFileSync((await lamina.path())!);
  expect(pngLamina.subarray(1, 4).toString()).toBe("PNG");
  expect(pngLamina.readUInt32BE(16)).toBe(1600);
  expect(pngLamina.readUInt32BE(20)).toBeGreaterThan(900);
  if (shots) await lamina.saveAs(`${shots}/lamina-trailer.png`);

  // Adjuntar a un pedido: el backend de mentira recibe el tráiler y su parte.
  await parte.getByRole("radio", { name: "Solo cabina" }).click();
  await cargado();
  await page.getByRole("button", { name: "Adjuntar a pedido" }).click();
  const dialogo = page.getByRole("dialog", { name: "Adjuntar a pedido" });
  await expect(dialogo).toBeVisible({ timeout: 120_000 });
  await dialogo.getByRole("list", { name: "Pedidos" }).getByRole("button", { name: /#101.*Colegio San Marcos/ }).click();
  await expect(page.getByText("Mockup adjuntado al pedido #101")).toBeVisible({ timeout: 60_000 });
  const recibidos = (await (await request.get(`${MOCK_API}/__e2e/mockups`)).json()) as Array<{
    garment: string;
    config: { garment: string; vehiclePart?: string; sizes?: unknown };
  }>;
  expect(recibidos).toHaveLength(1);
  expect(recibidos[0].garment).toBe("trailer");
  expect(recibidos[0].config.vehiclePart).toBe("cab");
  expect(recibidos[0].config.sizes).toBeUndefined();

  // Plantilla de vehículo: miniatura chica y la parte se conserva.
  await page.getByRole("button", { name: "Guardar como plantilla" }).click();
  const guardar = page.getByRole("dialog", { name: "Guardar como plantilla" });
  await guardar.getByRole("textbox", { name: "Nombre de la plantilla" }).fill("Tráiler cabina");
  await guardar.getByRole("button", { name: "Guardar plantilla" }).click();
  await expect(page.getByText("Plantilla «Tráiler cabina» guardada")).toBeVisible({ timeout: 90_000 });
  const guardadas = (await (await request.get(`${MOCK_API}/__e2e/mockup-templates`)).json()) as Array<{
    garment: string;
    thumbnailUrl: string;
    config: { vehiclePart?: string };
  }>;
  expect(guardadas[0]).toMatchObject({ garment: "trailer", config: { vehiclePart: "cab" } });
  expect(guardadas[0].thumbnailUrl).toMatch(/^data:image\/jpeg;base64,/);
  expect(guardadas[0].thumbnailUrl.length).toBeLessThan(96 * 1024 * 1.4);
  expect(errores).toEqual([]);
});
