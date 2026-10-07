/**
 * Backend de mentira para los tests end-to-end.
 *
 * Los e2e no pueden apuntar al backend real: necesitan datos estables y correr
 * sin red. Y no alcanza con interceptar desde el navegador, porque next-auth
 * hace el login desde el servidor de Next, no desde la página: esa request
 * nunca pasa por Playwright. Así que se levanta un backend mínimo y se apunta
 * `NEXT_PUBLIC_BACKEND_URL` acá.
 *
 * Sólo implementa lo que los flujos tocan. Cualquier otra ruta devuelve
 * una lista vacía, que es lo que la app espera de un catálogo sin datos.
 *
 * Rutas sólo para los tests (no existen en el backend real):
 * - `GET  /__e2e/orders`: los POST /orders recibidos (alta de pedido con tallas).
 * - `GET  /__e2e/mockups`: los POST de mockups recibidos, tal cual llegaron.
 * - `POST /__e2e/reset`:   vacía mockups, plantillas, logos y "Mis colores".
 * - `GET  /__e2e/preferences`: las preferencias guardadas (p. ej. `mockupColors`).
 * - `GET  /__e2e/mockup-templates`: plantillas guardadas, con su config.
 * - `GET  /__e2e/quotes`: las cotizaciones en memoria (para verificar lo guardado).
 * - `POST /__e2e/reset-inventory`: vuelve el inventario a sus 3 artículos iniciales.
 * - `POST /__e2e/reset-preferences`: vuelve las preferencias al estado inicial
 *   (barra lateral por defecto: `navPreferences: null`).
 * - `POST /__e2e/reset-branches`: sucursales, clientes, productos frecuentes y contadores de la sucursal.
 * - `POST /__e2e/seed-branch-orders {count}`: `count` pedidos extra de Punto Madero (alternan pendiente/entregado).
 * - `GET  /__e2e/clients` · `GET /__e2e/presets` · `GET /__e2e/forbidden-calls`: lo guardado / lo que la sucursal intentó pedir.
 * - `POST /__e2e/reset-tareas`: vuelve las tareas de área (Modo TV) al inicio.
 */
import { createServer } from "node:http";
import { deflateSync } from "node:zlib";

const PORT = Number(process.env.MOCK_API_PORT ?? 4010);

const usuarios = [
  { id: 1, username: "recepcion1", firstName: "Rita", lastName: "Ponce", isSharedAccount: false, roles: [{ id: 1, name: "recepcion" }] },
  { id: 2, username: "bordado", firstName: "Bordado", lastName: "", isSharedAccount: true, roles: [{ id: 2, name: "bordado" }] },
  { id: 3, username: "jeguia1", firstName: "José", lastName: "Eguía", isSharedAccount: false, roles: [{ id: 3, name: "diseno" }, { id: 2, name: "bordado" }] },
  { id: 10, username: "admin1", firstName: "Ada", lastName: "Mora", isSharedAccount: false, roles: [{ id: 30, name: "admin" }] },
  // Cuenta compartida de la sucursal "Punto Madero" (rol sucursal + branchId).
  { id: 9, username: "puntomadero", firstName: "Punto Madero", lastName: "", isSharedAccount: true, roles: [{ id: 20, name: "sucursal" }], branchId: 1, branch: { id: 1, name: "Punto Madero" } },
];

const roles = [
  { id: 1, name: "recepcion" }, { id: 2, name: "bordado" }, { id: 3, name: "diseno" },
  { id: 20, name: "sucursal" }, { id: 30, name: "admin" },
];

/** Sucursales y empleados (en memoria; `/__e2e/reset-branches` los restaura). */
const sucursalesIniciales = () => [
  {
    id: 1, name: "Punto Madero", active: true,
    employees: [
      { id: 1, branchId: 1, name: "Ana López", active: true },
      { id: 2, branchId: 1, name: "Beto Ruiz", active: false },
      { id: 3, branchId: 1, name: "Carla Díaz", active: true },
    ],
  },
];
let sucursales = sucursalesIniciales();
let siguienteEmpleadoId = 10;
/** Cuerpos de los POST /orders hechos desde la sucursal (los lee el test). */
let pedidosSucursalCreados = [];
let siguientePedidoSucursalId = 200;

const estados = [
  { id: 1, name: "pendiente" },
  { id: 3, name: "en proceso" },
  { id: 4, name: "terminado" },
  { id: 5, name: "entregado" },
  { id: 10, name: "cancelado" },
  { id: 6, name: "en diseño" },
  { id: 7, name: "esperando autorización" },
  { id: 8, name: "cambios solicitados" },
  { id: 9, name: "autorizado" },
];

/** Estado mutable: los tests cambian estas tareas y vuelven a pedir /orders. */
const tareasIniciales = () => [{ id: 1, orderId: 101, area: "bordado", status: "pendiente", assignedUserId: 2, createdAt: "2026-09-01T10:00:00.000Z", assignedUser: usuarios[1] }];
let tareas = tareasIniciales();

/**
 * Más trabajo del área de Bordado, sólo para el Modo TV de Tareas
 * (`/orders/my-area-tasks` y `/orders/my-tasks`). Sus pedidos no están en
 * `GET /orders` para no mover los tableros que prueban los otros flujos. Las
 * fechas son relativas a "ahora" para que cada columna tenga su semáforo.
 */
const companero = { id: 8, username: "luis", firstName: "Luis", lastName: "Paz", isSharedAccount: false };
const enHoras = (h) => new Date(Date.now() + h * 3_600_000).toISOString();
const pedidoTv = (id, clientNameOverride, description, deliveryDate) => ({
  id, description, deliveryDate, statusId: 9, clientNameOverride, client: null,
  creationDate: enHoras(-30), status: { id: 9, name: "autorizado" },
});
const tareasTvIniciales = () => [
  { id: 2, orderId: 103, area: "bordado", status: "en_proceso", assignedUserId: 3, createdAt: enHoras(-20), startedAt: enHoras(-2), completedAt: null, assignedUser: usuarios[2], order: pedidoTv(103, "Club Deportivo Norte", "30 gorras con escudo bordado", enHoras(30)) },
  { id: 3, orderId: 104, area: "bordado", status: "terminado", assignedUserId: 8, createdAt: enHoras(-40), startedAt: enHoras(-6), completedAt: enHoras(-1), assignedUser: companero, order: pedidoTv(104, "Hotel Las Palmas", "Batas con nombre bordado", enHoras(48 + 72)) },
  { id: 4, orderId: 105, area: "bordado", status: "pendiente", assignedUserId: null, createdAt: enHoras(-5), startedAt: null, completedAt: null, assignedUser: null, order: pedidoTv(105, "Café Central", "Mandiles con logo", enHoras(24 * 6)) },
  { id: 5, orderId: 106, area: "bordado", status: "pendiente", assignedUserId: 8, createdAt: enHoras(-8), startedAt: null, completedAt: null, assignedUser: companero, order: pedidoTv(106, "Taller Ruiz", "Overoles con parche", enHoras(20)) },
];
let tareasTv = tareasTvIniciales();

/**
 * Pedido #110 "esperando autorización" para el flujo autorizar → hoja de
 * materiales → producción. NO está en `GET /orders` (para no mover los
 * tableros de los otros flujos): se abre con `?openOrderId=110`. Imita al
 * backend: autorizar + hoja en una sola petición; los insumos "nosotros"
 * quedan apartados y se descuentan al terminar la tarea de bordado.
 */
const ORDEN_AUTORIZAR = 110;
/** Veces que una cuenta de sucursal pidió la hoja de materiales (debe ser 0). */
let hojasPedidasPorSucursal = 0;

/** Llamadas que la sucursal NO debe hacer (inventario, empresas); el test comprueba que son 0. */
let llamadasProhibidas = { inventory: 0, companies: 0 };

/**
 * Clientes (`/clients`): la sucursal sólo ve y crea los SUYOS (el backend los
 * liga a su sucursal); la matriz ve todos y puede filtrar `?branchId=`.
 */
const clientesIniciales = () => [
  { id: 1, first_name: "Colegio", last_name: "San Marcos", phone: null, email: null, address: null, companyId: null, company: null, branchId: null, branch: null },
  { id: 2, first_name: "Ferretería", last_name: "El Tornillo", phone: null, email: null, address: null, companyId: null, company: null, branchId: null, branch: null },
  { id: 3, first_name: "Escuela", last_name: "Madero", phone: "555-0100", email: null, address: null, companyId: null, company: null, branchId: 1, branch: { id: 1, name: "Punto Madero" } },
];
let clientes = clientesIniciales();
let siguienteClienteId = 50;

/** Catálogo de productos frecuentes (`/order-product-presets`): empieza vacío. */
let presetsProducto = [];
let siguientePresetId = 1;
const clavePreset = (t) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

const autorizarInicial = () => ({ aprobada: false, recibido: null, tarea: null, supply: null, movimientos: [] });
let autorizar = autorizarInicial();
const pedidoAutorizar = () => ({
  id: ORDEN_AUTORIZAR,
  statusId: autorizar.aprobada ? 9 : 7,
  status: autorizar.aprobada ? { id: 9, name: "autorizado" } : { id: 7, name: "esperando autorización" },
  clientNameOverride: "Escuela Primaria Benito Juárez",
  description: "40 playeras con escudo bordado",
  creationDate: "2026-09-10T10:00:00.000Z",
  deliveryDate: "2026-10-25T18:00:00.000Z",
  deliveredAt: null,
  area: autorizar.aprobada ? "bordado" : "diseno",
  productionArea: "bordado",
  requiresDesign: true,
  areaTasks: [tareaAutorizar()],
  orderProducts: [],
  assignedUser: null,
});
const tareaAutorizar = () =>
  autorizar.tarea ?? { id: 90, orderId: ORDEN_AUTORIZAR, area: "bordado", status: "pendiente", assignedUserId: 2, createdAt: "2026-09-10T10:00:00.000Z", assignedUser: usuarios[1], supply: null };
const rondaAutorizar = () => [
  ronda(20, ORDEN_AUTORIZAR, 1, [1005], autorizar.aprobada ? { approved: true, approvedAt: new Date().toISOString() } : {}),
];
/** Apartado por artículo: líneas "nosotros" sin descontar. */
const apartado = (itemId) =>
  autorizar.supply?.source === "nosotros"
    ? autorizar.supply.lines.filter((l) => l.inventoryItemId === itemId && !l.discountedAt).reduce((t, l) => t + l.quantity, 0)
    : 0;
const hojaAutorizar = () => {
  const terminada = tareaAutorizar().status === "terminado";
  const lines = autorizar.supply?.lines.map((l) => {
    const a = inventario.find((x) => x.id === l.inventoryItemId);
    const pendingDiscount = Boolean(terminada && a && !l.discountedAt && autorizar.supply.source === "nosotros");
    return {
      ...l, state: l.discountedAt ? "descontado" : "apartado",
      pendingDiscount, shortfall: pendingDiscount ? Math.max(0, l.quantity - a.quantity) : 0,
      stock: a ? { quantity: a.quantity, reserved: apartado(a.id), available: a.quantity - apartado(a.id) } : null,
    };
  });
  return {
    areas: [
      {
        taskId: 90, area: "bordado", status: tareaAutorizar().status,
        supply: autorizar.supply && { ...autorizar.supply, lines },
        pendingDiscount: Boolean(lines?.some((l) => l.pendingDiscount)),
      },
    ],
    movements: autorizar.movimientos,
  };
};
/**
 * Terminar descuenta (SALIDA); regresar de terminado devuelve (ENTRADA). Como
 * el backend, terminar NUNCA falla por falta de stock: la línea que no alcanza
 * queda apartada ("descuento pendiente") y se reintenta con `descontarPendientes`.
 */
function aplicarInsumos(anterior, nuevo) {
  const terminando = nuevo === "terminado" && anterior !== "terminado";
  const reabriendo = anterior === "terminado" && nuevo !== "terminado";
  if (!terminando && !reabriendo) return;
  descontarLineas(terminando ? "terminando" : "reabriendo");
}
function descontarLineas(modo) {
  const lines = autorizar.supply?.source === "nosotros" ? autorizar.supply.lines.filter((l) => l.inventoryItemId) : [];
  const terminando = modo !== "reabriendo";
  for (const l of lines.filter((x) => (terminando ? !x.discountedAt : x.discountedAt))) {
    const a = inventario.find((x) => x.id === l.inventoryItemId);
    if (terminando && l.quantity > a.quantity) continue; // sin existencia: se queda pendiente
    const delta = terminando ? -l.quantity : l.quantity;
    a.quantity += delta;
    l.discountedAt = terminando ? new Date().toISOString() : null;
    autorizar.movimientos.unshift({
      id: 900 + autorizar.movimientos.length, itemId: a.id, type: terminando ? "SALIDA" : "ENTRADA", delta, balanceAfter: a.quantity,
      note: null, areaTaskId: 90, createdAt: new Date().toISOString(), item: { id: a.id, name: a.name, unit: a.unit }, createdBy: { id: 2, firstName: "Bordado" },
    });
  }
}

/** Usuario del token (el `sub` del JWT de mentira). */
const esSucursal = (u) => u.roles.some((r) => r.name === "sucursal");

function usuarioDe(req) {
  try {
    const payload = (req.headers.authorization ?? "").split(".")[1];
    const { sub } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return usuarios.find((u) => u.id === sub) ?? usuarios[0];
  } catch {
    return usuarios[0];
  }
}

/** Todas las tareas de área con su pedido (forma de `findForUser`). */
function tareasDelArea(u) {
  const roles = u.roles.map((r) => r.name);
  const deBase = tareas.map((t) => {
    const p = pedidos().find((x) => x.id === t.orderId);
    return {
      startedAt: null, completedAt: null, ...t,
      order: { id: p.id, description: p.description, deliveryDate: p.deliveryDate, statusId: p.statusId, clientNameOverride: p.clientNameOverride, client: null },
    };
  });
  const sinExtras = tareasTv.map(({ order: { creationDate, status, ...order }, ...t }) => ({ ...t, order }));
  return [...deBase, ...sinExtras].filter((t) => roles.includes(t.area));
}

/** Bandeja "Tareas asignadas" (forma de `findMyTasks`): lo mío y lo libre, sin terminar. */
function misTareas(u) {
  const roles = u.roles.map((r) => r.name);
  const libre = (t) => t.assignedUserId == null || t.assignedUser?.isSharedAccount;
  const mia = (t) => !u.isSharedAccount && t.assignedUserId === u.id;
  const items = [];
  if (roles.includes("diseno")) {
    for (const p of pedidos().filter((x) => x.area === "diseno")) {
      const asignado = p.assignedUser ?? null;
      if (asignado && asignado.id !== u.id) continue;
      items.push({
        key: `design-${p.id}`, kind: "design", area: "diseno", taskId: null, status: p.status.name,
        mine: asignado?.id === u.id, assignee: null, startedAt: null,
        order: { id: p.id, description: p.description, deliveryDate: p.deliveryDate, creationDate: p.creationDate, statusId: p.statusId, clientNameOverride: p.clientNameOverride, designStartedAt: null, designStartedByName: null, client: null, status: p.status },
      });
    }
  }
  for (const t of [...tareas.map((x) => ({ ...x, order: pedidos().find((p) => p.id === x.orderId) })), ...tareasTv]) {
    if (!roles.includes(t.area) || t.status === "terminado" || !(libre(t) || mia(t))) continue;
    const o = t.order;
    items.push({
      key: `task-${t.id}`, kind: "production", area: t.area, taskId: t.id, status: t.status,
      mine: mia(t), assignee: libre(t) ? null : t.assignedUser, startedAt: t.startedAt ?? null,
      order: { id: o.id, description: o.description, deliveryDate: o.deliveryDate, creationDate: o.creationDate, statusId: o.statusId, clientNameOverride: o.clientNameOverride, designStartedAt: null, designStartedByName: null, client: null, status: o.status },
    });
  }
  const t90 = tareaAutorizar();
  if (autorizar.aprobada && roles.includes("bordado") && t90.status !== "terminado" && (libre(t90) || mia(t90))) {
    const o = pedidoAutorizar();
    items.push({
      key: "task-90", kind: "production", area: "bordado", taskId: 90, status: t90.status,
      mine: mia(t90), assignee: libre(t90) ? null : t90.assignedUser, startedAt: null, supply: autorizar.supply,
      order: { id: o.id, description: o.description, deliveryDate: o.deliveryDate, creationDate: o.creationDate, statusId: o.statusId, clientNameOverride: o.clientNameOverride, designStartedAt: null, designStartedByName: null, client: null, status: o.status },
    });
  }
  return items;
}

/**
 * PNG de un color liso (con una franja más oscura arriba), generado a mano para
 * no versionar binarios: alcanza para ver la hoja de autorización en pantalla.
 */
function pngLiso(ancho, alto, [r, g, b]) {
  const crcTabla = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const byte of buf) c = crcTabla[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (tipo, datos) => {
    const largo = Buffer.alloc(4);
    largo.writeUInt32BE(datos.length);
    const cuerpo = Buffer.concat([Buffer.from(tipo, "ascii"), datos]);
    const suma = Buffer.alloc(4);
    suma.writeUInt32BE(crc(cuerpo));
    return Buffer.concat([largo, cuerpo, suma]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0);
  ihdr.writeUInt32BE(alto, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const filas = [];
  for (let y = 0; y < alto; y++) {
    const oscuro = y < alto / 5 ? 0.7 : 1;
    const fila = Buffer.alloc(1 + ancho * 3);
    for (let x = 0; x < ancho; x++) fila.set([r * oscuro, g * oscuro, b * oscuro].map(Math.round), 1 + x * 3);
    filas.push(fila);
  }
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(filas))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${png.toString("base64")}`;
}

/** PDF mínimo de una página (sólo para el botón Abrir / Descargar). */
const PDF_MINIMO = `data:application/pdf;base64,${Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n"
).toString("base64")}`;

/**
 * Rondas de diseño por pedido (`GET /orders/:id/design-revisions`) y el
 * contenido de cada archivo (`.../files/:fileId`). El #101 ya está autorizado
 * en la ronda 2 (dos imágenes); el #103 (Modo TV) en un PDF; el #105 tiene la
 * ronda 1 enviada, todavía sin respuesta del cliente.
 */
const archivosDiseno = {
  1001: { filename: "ronda1-frente.png", mimeType: "image/png", dataUrl: pngLiso(320, 200, [148, 163, 184]) },
  1002: { filename: "hoja-frente.png", mimeType: "image/png", dataUrl: pngLiso(480, 320, [37, 99, 235]) },
  1003: { filename: "hoja-espalda.png", mimeType: "image/png", dataUrl: pngLiso(480, 320, [5, 150, 105]) },
  1004: { filename: "hoja-gorras.pdf", mimeType: "application/pdf", dataUrl: PDF_MINIMO },
  1005: { filename: "mandil-propuesta.png", mimeType: "image/png", dataUrl: pngLiso(480, 320, [217, 119, 6]) },
};
const ronda = (id, orderId, round, fileIds, extra = {}) => ({
  id, orderId, round, approved: false, approvedAt: null, feedbackText: null, feedbackAt: null,
  sentAt: "2026-09-02T12:00:00.000Z", createdAt: "2026-09-02T12:00:00.000Z",
  hasFeedbackFile: false, feedbackFiles: [],
  hasMontageFile: fileIds.length > 0,
  montageFileName: archivosDiseno[fileIds[0]]?.filename ?? null,
  montageFileMime: archivosDiseno[fileIds[0]]?.mimeType ?? null,
  montageFiles: fileIds.map((fid) => ({ id: fid, filename: archivosDiseno[fid].filename, mimeType: archivosDiseno[fid].mimeType })),
  ...extra,
});
const rondasDiseno = {
  101: [
    ronda(11, 101, 1, [1001], { feedbackText: "El logo más grande", feedbackAt: "2026-09-03T10:00:00.000Z" }),
    ronda(12, 101, 2, [1002, 1003], { sentAt: "2026-09-04T12:00:00.000Z", approved: true, approvedAt: "2026-09-05T16:30:00.000Z" }),
  ],
  103: [ronda(13, 103, 1, [1004], { approved: true, approvedAt: "2026-09-05T16:30:00.000Z" })],
  105: [ronda(15, 105, 1, [1005])],
};

const pedidos = () => [
  {
    id: 101,
    statusId: 9,
    status: { id: 9, name: "autorizado" },
    clientNameOverride: "Colegio San Marcos",
    description: "24 polos bordados en pecho izquierdo",
    creationDate: "2026-09-01T10:00:00.000Z",
    deliveryDate: "2026-09-25T18:00:00.000Z",
    deliveredAt: null,
    area: "bordado",
    productionArea: "bordado",
    requiresDesign: true,
    areaTasks: tareas,
    orderProducts: [{ customName: "Polo", quantity: 24, sizes: { general: { M: 10, L: 14 } } }],
    assignedUser: null,
  },
  {
    id: 102,
    statusId: 6,
    status: { id: 6, name: "en diseño" },
    clientNameOverride: "Ferretería El Tornillo",
    description: "Lona 2x1 con logo",
    creationDate: "2026-09-03T09:00:00.000Z",
    deliveryDate: "2026-09-20T18:00:00.000Z",
    deliveredAt: null,
    area: "diseno",
    requiresDesign: true,
    areaTasks: [],
    orderProducts: [],
    assignedUser: usuarios[2],
  },
  {
    id: 110,
    statusId: 6,
    status: { id: 6, name: "en diseño" },
    clientNameOverride: "Escuela Madero",
    description: "Sudaderas con escudo (Punto Madero)",
    creationDate: "2026-09-04T09:00:00.000Z",
    deliveryDate: "2026-09-28T18:00:00.000Z",
    deliveredAt: null,
    area: "diseno",
    requiresDesign: true,
    areaTasks: [],
    orderProducts: [{ customName: "Sudadera", quantity: 12 }],
    assignedUser: usuarios[2],
    branchId: 1,
    branch: { id: 1, name: "Punto Madero" },
    branchEmployeeId: 1,
    branchEmployee: { id: 1, name: "Ana López" },
  },
  ...pedidosSucursalCreados,
];

/**
 * Mockups guardados por pedido (en memoria). `recibidos` guarda el cuerpo de
 * cada POST para que el test verifique qué mandó la app.
 */
let mockups = [];
let recibidos = [];
let siguienteMockupId = 1;

const resumenMockup = ({ id, orderId, garment, createdAt, createdBy }) => ({ id, orderId, garment, createdAt, createdBy });

/** Login: el usuario que se pide (por username) con sus roles; si no existe, Recepción. */
function login(body) {
  const { username } = JSON.parse(body || "{}");
  const u = usuarios.find((x) => x.username === username) ?? usuarios[0];
  const roles = u.roles.map((r) => r.name);
  return {
    id: u.id, username: u.username, token: token(u, roles), refreshToken: token(u, roles),
    first_name: u.firstName, last_name: u.lastName, roles,
  };
}

/** `navPreferences`: barra lateral del usuario; PATCH la guarda y GET la devuelve tal cual. */
const PREFERENCIAS_INICIALES = { hasSeenOnboarding: true, navPreferences: null };
let preferencias = { ...PREFERENCIAS_INICIALES };

/** Prendas que acepta el backend para un mockup (MOCKUP_GARMENTS). */
const PRENDAS_MOCKUP = ["tshirt", "cap", "hoodie", "dress-shirt", "termo", "taza", "car", "minivan", "pickup", "trailer", "bicycle"];

/** Plantillas y logos de mockups (compartidos por la empresa), en memoria. */
let plantillas = [];
let siguientePlantillaId = 1;
let logos = [];
let siguienteLogoId = 1;
const autor = { id: 1, name: "Rita Ponce" };
const resumenPlantilla = ({ config, ...resto }) => resto;
const resumenLogo = ({ imageDataUrl, thumbnailDataUrl, ...resto }) => resto;

/**
 * Cotizaciones (`/quotes`) en memoria, con las reglas del backend real: el
 * subestado decide la etapa, sólo la etapa toma el subestado por defecto, y
 * se ordenan por fecha de prioridad (la más vieja primero) y luego por
 * última modificación.
 */
const SUBESTADOS = {
  por_enviar: ["lista", "pendiente_medidas", "info", "esperando_montaje"],
  enviada: ["esperando_respuesta", "aceptada", "no_aceptada", "comentarios"],
};
const POR_DEFECTO = { por_enviar: "lista", enviada: "esperando_respuesta" };
const etapaDe = (status) => (SUBESTADOS.por_enviar.includes(status) ? "por_enviar" : "enviada");
let cotizaciones = [];
let siguienteCotizacionId = 1;
let reloj = 0;
/** Marca de tiempo estrictamente creciente: dos cambios en el mismo ms igual se ordenan. */
const ahoraIso = () => new Date(Date.now() + reloj++).toISOString();

function etapaYSubestado(stage, status, actual) {
  if (status) {
    if (!etapaDe(status) || ![...SUBESTADOS.por_enviar, ...SUBESTADOS.enviada].includes(status)) throw new Error("Subestado inválido");
    if (stage && etapaDe(status) !== stage) throw new Error(`El subestado "${status}" no corresponde a la etapa "${stage}"`);
    return { stage: etapaDe(status), status };
  }
  if (stage) return actual && actual.stage === stage ? actual : { stage, status: POR_DEFECTO[stage] };
  return actual ?? { stage: "por_enviar", status: "lista" };
}

function nuevaCotizacion(item) {
  if (!item?.description?.trim()) throw new Error("La descripción es obligatoria (máx. 1000 caracteres)");
  if (!item.clientName?.trim() && !item.clientId) throw new Error("El nombre del cliente es obligatorio (máx. 120 caracteres)");
  const { stage, status } = etapaYSubestado(item.stage, item.status);
  const ahora = ahoraIso();
  return {
    id: siguienteCotizacionId++,
    clientId: item.clientId ?? null,
    clientName: item.clientName.trim(),
    description: item.description.trim(),
    stage,
    status,
    comment: item.comment?.trim() || null,
    priorityDate: item.priorityDate ?? null,
    sentAt: stage === "enviada" ? ahora : null,
    orderId: null,
    createdAt: ahora,
    updatedAt: ahora,
    createdBy: autor,
  };
}

const ordenCotizaciones = (a, b) => {
  if (a.priorityDate !== b.priorityDate) {
    if (!a.priorityDate) return 1;
    if (!b.priorityDate) return -1;
    return a.priorityDate < b.priorityDate ? -1 : 1;
  }
  return b.updatedAt.localeCompare(a.updatedAt) || b.id - a.id;
};

/**
 * Inventario por departamento (`/inventory`) en memoria, con las reglas de
 * códigos de barras del backend: `EMD-000123` por omisión, códigos propios de
 * 3–64 ASCII, `EMD-<número>` reservado, únicos (409 con el nombre del dueño).
 */
const inventarioInicial = () => [
  { id: 1, area: "bordado", name: "Hilo poliéster rojo 1147", sku: "HP-1147", barcode: null, category: "Hilos", unit: "cono", color: "Rojo", brand: "Madeira", location: "Estante A-3", quantity: 12, minStock: 5, unitCost: 48, notes: null, materialId: null, supplierId: null },
  { id: 2, area: "impresiones", name: "Tinta cyan para plotter", sku: null, barcode: null, category: "Tintas", unit: "litro", color: "Cyan", brand: null, location: null, quantity: 3, minStock: 2, unitCost: 650, notes: null, materialId: null, supplierId: null },
  { id: 3, area: "bordado", name: "Estabilizador cut-away 45 cm", sku: null, barcode: "7501234567890", category: "Estabilizador / entretela", unit: "rollo", color: null, brand: null, location: null, quantity: 0, minStock: 1, unitCost: null, notes: null, materialId: null, supplierId: null },
];
let inventario = inventarioInicial();
let movimientosInventario = [];
let siguienteArticuloId = 4;
let siguienteMovimientoId = 1;
let solicitudesReabasto = [];
let siguienteSolicitudId = 1;

const GESTORES = ["recepcion", "admin", "superuser"];
const AREAS_INVENTARIO = ["taller", "dtf", "bordado", "laser", "impresiones"];
/** Áreas de inventario que ve un usuario (como `areasFor` del backend). */
function areasDe(u) {
  const nombres = u.roles.map((x) => x.name);
  if (nombres.some((n) => GESTORES.includes(n))) return ["bordado", "impresiones"];
  return nombres.filter((n) => AREAS_INVENTARIO.includes(n));
}

const codigoPorOmision = (id) => `EMD-${String(id).padStart(6, "0")}`;
const estadoStock = (q, min) => (q <= 0 ? "out" : min != null && q <= min ? "low" : "ok");
const articuloJson = (a) => ({
  ...a,
  barcode: a.barcode ?? codigoPorOmision(a.id),
  material: null,
  supplier: null,
  reserved: apartado(a.id),
  available: a.quantity - apartado(a.id),
  stockStatus: estadoStock(a.quantity, a.minStock),
  totalValue: a.unitCost == null ? null : a.quantity * a.unitCost,
});

/** `{ code }` o `{ error, status }`, como `normalizeBarcode` + `assertBarcodeFree` del backend. */
function validarCodigo(raw, ownId) {
  const code = String(raw).trim();
  if (code.length < 3 || code.length > 64) return { status: 400, error: "El código de barras debe tener entre 3 y 64 caracteres" };
  if (!/^[\x20-\x7E]+$/.test(code)) return { status: 400, error: "El código de barras sólo admite letras sin acentos, números, espacios y símbolos ASCII" };
  if (/^EMD-\d+$/.test(code) && code !== (ownId ? codigoPorOmision(ownId) : null)) {
    return { status: 400, error: "Los códigos EMD-<número> los asigna el sistema; deja el campo vacío para usar el automático" };
  }
  const dueno = inventario.find((a) => (a.barcode ?? codigoPorOmision(a.id)) === code);
  if (dueno && dueno.id !== ownId) return { status: 409, error: `Ese código ya está asignado a ${dueno.name}` };
  return { code };
}

/** Mismo cálculo que `registerMovement` del backend; `{ status, body }`. */
function registrarMovimiento(articulo, dto, usuario = usuarios[0]) {
  const quantity = Number(dto.quantity);
  if (!["ENTRADA", "SALIDA", "AJUSTE"].includes(dto.type) || !(quantity >= 0)) {
    return { status: 400, body: { message: "Movimiento inválido" } };
  }
  const delta = dto.type === "ENTRADA" ? quantity : dto.type === "SALIDA" ? -quantity : quantity - articulo.quantity;
  if (articulo.quantity + delta < 0) {
    return { status: 400, body: { message: `Stock insuficiente: hay ${articulo.quantity} ${articulo.unit}` } };
  }
  const antes = articulo.quantity;
  articulo.quantity += delta;
  const esArea = !usuario.roles.some((x) => ["recepcion", "admin", "superuser"].includes(x.name));
  const movement = {
    id: siguienteMovimientoId++,
    itemId: articulo.id,
    type: dto.type,
    delta,
    balanceAfter: articulo.quantity,
    balanceBefore: antes,
    area: articulo.area,
    reason: dto.reason ?? dto.note ?? null,
    source: esArea ? "area" : "recepcion",
    unitCost: dto.unitCost ?? null,
    note: dto.note ?? null,
    orderId: dto.orderId ?? null,
    createdAt: new Date().toISOString(),
    item: { id: articulo.id, name: articulo.name, unit: articulo.unit, area: articulo.area },
    createdBy: { id: usuario.id, firstName: usuario.firstName, lastName: usuario.lastName },
  };
  movimientosInventario.unshift(movement);
  return { status: 201, body: { movement, item: articuloJson(articulo) } };
}

/** POST /orders recibidos (alta de pedido). */
const pedidosCreados = [];

const rutas = {
  "GET /orders": () => pedidos(),
  "GET /status": () => estados,
  "GET /users": () => usuarios,
  "GET /clients": () => clientes,
  "GET /settings": () => ({ deliveredRetentionHours: 72 }),
  "GET /notifications/unread-count": () => ({ unreadCount: 0 }),
  // Tour de bienvenida ya visto: si no, su capa (fixed, z-110) tapa la
  // pantalla y se come los clicks de los tests.
  "GET /users/me/preferences": () => preferencias,
  // Tableros de "Inicio". Sin esto el mock contestaba `[]`, la pantalla de
  // Inicio tronaba al llegar los datos (`totals` indefinido) y esa caída le
  // ganaba al primer clic del menú: la URL se quedaba en /dashboard/inicio.
  "GET /dashboard/reception": () => ({
    generatedAt: "2026-10-07T12:00:00.000Z", dayStart: "2026-10-07T00:00:00.000Z",
    totals: { active: 0, inDesign: 0, waitingClient: 0, inProduction: 0, ready: 0, noDate: 0 },
    deadlines: { overdue: 0, atRisk: 0, onTime: 0, noDate: 0 },
    today: { created: 0, delivered: 0, tasksCompleted: 0, designsApproved: 0 },
    areas: [], attention: [], attentionTotal: 0, throughput: [], clientsDue: [],
    alerts: { lowStock: 0, outOfStock: 0, lowStockItems: [], purchasesDue: 0 },
  }),
  "GET /dashboard/design": () => ({
    generatedAt: "2026-10-07T12:00:00.000Z", dayStart: "2026-10-07T00:00:00.000Z",
    counters: { changesRequested: 0, notStarted: 0, inProgress: 0, waitingClient: 0, overdue: 0, atRisk: 0, approvedToday: 0, approvedWeek: 0 },
    items: [], waitingClient: [], team: [], rounds: { avgToApproval: null, approvedLast30: 0, manyRounds: 0 },
  }),
  "GET /dashboard/production": () => ({
    generatedAt: "2026-10-07T12:00:00.000Z", dayStart: "2026-10-07T00:00:00.000Z", areas: [],
    counters: { overdue: 0, atRisk: 0, notStarted: 0, inProgress: 0, doneToday: 0, upcoming: 0 },
    items: [], upcoming: [], team: [], events: [],
  }),
};

/** JWT sin firmar de verdad: sólo necesita un `exp` futuro que `jose` pueda leer. */
function token(u = usuarios[0], roles = ["recepcion"]) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: u.id, username: u.username, roles, exp })}.firma-de-mentira`;
}

createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const path = url.pathname;

  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-headers", "*");
  res.setHeader("access-control-allow-methods", "*");
  if (req.method === "OPTIONS") return res.writeHead(204).end();

  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const send = (data, code = 200) => {
      res.writeHead(code, { "content-type": "application/json" });
      res.end(JSON.stringify(data));
    };

    if (req.method === "POST" && path === "/auth/login") return send(login(body));

    if (req.method === "PATCH" && path === "/users/me/preferences") {
      preferencias = { ...preferencias, ...JSON.parse(body || "{}") };
      return send(preferencias);
    }

    // La hoja de materiales no es de la sucursal: 403 (y se cuenta, para que el
    // test compruebe que la pantalla ni siquiera la pide).
    if (req.method === "GET" && /^\/orders\/\d+\/area-supplies$/.test(path) && esSucursal(usuarioDe(req))) {
      hojasPedidasPorSucursal++;
      return send({ message: "Forbidden" }, 403);
    }
    if (req.method === "GET" && path === "/__e2e/area-supplies-sucursal") return send({ pedidas: hojasPedidasPorSucursal });

    // Ganchos sólo para los tests.
    if (req.method === "POST" && path === "/__e2e/reset-preferences") {
      preferencias = { ...PREFERENCIAS_INICIALES };
      return send(preferencias);
    }
    if (req.method === "POST" && path === "/__e2e/reset-tareas") {
      tareas = tareasIniciales();
      tareasTv = tareasTvIniciales();
      autorizar = autorizarInicial();
      inventario = inventarioInicial();
      movimientosInventario = [];
      return send({ ok: true });
    }
    if (req.method === "GET" && path === "/__e2e/autorizacion") return send({ recibido: autorizar.recibido });
    if (path === `/orders/${ORDEN_AUTORIZAR}/area-supplies` && req.method === "GET") return send(hojaAutorizar());
    // Reintenta el descuento de lo pendiente (sólo Recepción/admin).
    if (path === `/orders/${ORDEN_AUTORIZAR}/area-supplies/bordado/discount-pending` && req.method === "POST") {
      if (!usuarioDe(req).roles.some((r) => GESTORES.includes(r.name))) return send({ message: "Forbidden" }, 403);
      descontarLineas("terminando");
      return send(hojaAutorizar());
    }
    // Entrada de stock sin pasar por la pantalla de inventario (prepara el reintento).
    if (req.method === "POST" && path === "/__e2e/reponer-stock") {
      const { itemId, quantity } = JSON.parse(body || "{}");
      inventario.find((a) => a.id === itemId).quantity += quantity;
      return send({ ok: true });
    }
    if (path === `/orders/${ORDEN_AUTORIZAR}/design-revisions` && req.method === "GET") return send(rondaAutorizar());
    if (path === `/orders/${ORDEN_AUTORIZAR}/area-tasks` && req.method === "GET") return send([tareaAutorizar()].map(({ supply, ...t }) => t));
    if (path === `/orders/${ORDEN_AUTORIZAR}/design-revisions/20/approve` && req.method === "PATCH") {
      const dto = JSON.parse(body || "{}");
      autorizar.recibido = dto;
      const hoja = (dto.supplies ?? []).find((x) => x.area === "bordado");
      if (!hoja) return send({ message: "Captura la hoja de materiales (origen de insumos) de: Bordado" }, 400);
      autorizar.aprobada = true;
      autorizar.supply = {
        id: 1, source: hoja.source,
        lines: hoja.lines.map((l, i) => {
          const a = inventario.find((x) => x.id === l.inventoryItemId);
          return { id: i + 1, inventoryItemId: l.inventoryItemId ?? null, description: l.description ?? a?.name ?? "", quantity: l.quantity, discountedAt: null, inventoryItem: a ? { id: a.id, name: a.name, unit: a.unit, area: a.area } : null };
        }),
      };
      autorizar.tarea = { ...tareaAutorizar(), supply: autorizar.supply };
      return send({ ...rondaAutorizar()[0], supplyWarnings: [] });
    }
    if (req.method === "GET" && path === "/orders/my-area-tasks") return send(tareasDelArea(usuarioDe(req)));
    if (req.method === "GET" && path === "/orders/my-tasks") return send(misTareas(usuarioDe(req)));
    if (req.method === "GET" && path === "/__e2e/mockups") return send(recibidos);
    if (req.method === "GET" && path === "/__e2e/orders") return send(pedidosCreados);
    if (req.method === "GET" && path === "/__e2e/preferences") return send(preferencias);
    if (req.method === "GET" && path === "/__e2e/mockup-templates") return send(plantillas);
    if (req.method === "GET" && path === "/__e2e/quotes") return send(cotizaciones);
    if (req.method === "POST" && path === "/__e2e/reset") {
      mockups = [];
      recibidos = [];
      plantillas = [];
      logos = [];
      cotizaciones = [];
      // "Mis colores" de mockups; la barra lateral tiene su propio reset.
      preferencias = { ...preferencias, mockupColors: null };
      return send({ ok: true });
    }

    // Cotizaciones: lista (filtros stage/status/q), alta, alta en bloque, edición, ligar pedido, baja.
    const cotizacion = path.match(/^\/quotes(?:\/(bulk|\d+)(?:\/(link-order))?)?$/);
    if (cotizacion) {
      const datos = () => JSON.parse(body || "{}");
      try {
        if (!cotizacion[1] && req.method === "GET") {
          const { stage, status } = Object.fromEntries(url.searchParams);
          const q = (url.searchParams.get("q") ?? "").toLowerCase().trim();
          return send(
            cotizaciones
              .filter((c) => (!stage || c.stage === stage) && (!status || c.status === status))
              .filter((c) => !q || `${c.clientName} ${c.description}`.toLowerCase().includes(q))
              .sort(ordenCotizaciones)
          );
        }
        if (!cotizacion[1] && req.method === "POST") {
          const nueva = nuevaCotizacion(datos());
          cotizaciones.push(nueva);
          return send(nueva, 201);
        }
        if (cotizacion[1] === "bulk" && req.method === "POST") {
          const { items } = datos();
          if (!Array.isArray(items) || items.length === 0 || items.length > 100) {
            return send({ message: "Agrega de 1 a 100 cotizaciones" }, 400);
          }
          const nuevas = items.map((item, i) => {
            try {
              return nuevaCotizacion(item);
            } catch (e) {
              throw new Error(`Cotización ${i + 1}: ${e.message}`);
            }
          });
          cotizaciones.push(...nuevas);
          return send(nuevas, 201);
        }
        const existente = cotizaciones.find((c) => c.id === Number(cotizacion[1]));
        if (!existente) return send({ message: "Cotización no encontrada" }, 404);
        if (cotizacion[2] === "link-order" && req.method === "POST") {
          const { orderId } = datos();
          if (existente.status !== "aceptada") return send({ message: "Sólo se puede ligar un pedido a una cotización aceptada" }, 400);
          if (cotizaciones.some((c) => c.orderId === orderId && c.id !== existente.id)) {
            return send({ message: `El pedido #${orderId} ya está ligado a otra cotización` }, 409);
          }
          existente.orderId = orderId;
          return send(existente, 201);
        }
        if (!cotizacion[2] && req.method === "PATCH") {
          const cambios = datos();
          if (cambios.stage !== undefined || cambios.status !== undefined) {
            const siguiente = etapaYSubestado(cambios.stage, cambios.status, { stage: existente.stage, status: existente.status });
            if (siguiente.stage === "enviada" && !existente.sentAt) existente.sentAt = ahoraIso();
            if (siguiente.stage === "por_enviar") existente.sentAt = null;
            Object.assign(existente, siguiente);
          }
          for (const campo of ["clientId", "description", "priorityDate"]) {
            if (cambios[campo] !== undefined) existente[campo] = cambios[campo];
          }
          if (cambios.clientName?.trim()) existente.clientName = cambios.clientName.trim();
          if (cambios.comment !== undefined) existente.comment = cambios.comment?.trim() || null;
          existente.updatedAt = ahoraIso();
          return send(existente);
        }
        if (!cotizacion[2] && req.method === "DELETE") {
          cotizaciones = cotizaciones.filter((c) => c !== existente);
          return res.writeHead(204).end();
        }
      } catch (e) {
        return send({ message: e.message }, 400);
      }
    }

    // Plantillas de mockup: lista (con miniatura, sin config), detalle, alta, renombrar, baja.
    const plantilla = path.match(/^\/mockup-templates(?:\/(\d+))?$/);
    if (plantilla) {
      const id = plantilla[1] ? Number(plantilla[1]) : null;
      if (id === null && req.method === "GET") return send(plantillas.map(resumenPlantilla));
      if (id === null && req.method === "POST") {
        const { name, garment, config, thumbnailDataUrl } = JSON.parse(body || "{}");
        if (!name || !garment || !config || typeof thumbnailDataUrl !== "string") {
          return send({ message: "name, garment, config y thumbnailDataUrl son obligatorios" }, 400);
        }
        if (thumbnailDataUrl.length > 140_000) return send({ message: "Miniatura demasiado grande" }, 413);
        const ahora = new Date().toISOString();
        const nueva = { id: siguientePlantillaId++, name, garment, createdAt: ahora, updatedAt: ahora, createdBy: autor, thumbnailUrl: thumbnailDataUrl, config };
        plantillas.unshift(nueva);
        return send(resumenPlantilla(nueva), 201);
      }
      const existente = plantillas.find((p) => p.id === id);
      if (!existente) return send({ message: "Plantilla no encontrada" }, 404);
      if (req.method === "GET") return send(existente);
      if (req.method === "PATCH") {
        existente.name = JSON.parse(body || "{}").name ?? existente.name;
        existente.updatedAt = new Date().toISOString();
        return send(resumenPlantilla(existente));
      }
      if (req.method === "DELETE") {
        plantillas = plantillas.filter((p) => p !== existente);
        return res.writeHead(204).end();
      }
    }

    // Biblioteca de logos: lista (más usados primero), miniatura, imagen, alta, renombrar, uso, baja.
    const logo = path.match(/^\/mockup-logos(?:\/(\d+)(?:\/(image|thumbnail|use))?)?$/);
    if (logo) {
      const id = logo[1] ? Number(logo[1]) : null;
      const accion = logo[2] ?? null;
      if (id === null && req.method === "GET") {
        return send([...logos].sort((a, b) => b.useCount - a.useCount || b.id - a.id).map(resumenLogo));
      }
      if (id === null && req.method === "POST") {
        const { name, imageDataUrl, thumbnailDataUrl } = JSON.parse(body || "{}");
        if (!name || typeof imageDataUrl !== "string" || typeof thumbnailDataUrl !== "string") {
          return send({ message: "name, imageDataUrl y thumbnailDataUrl son obligatorios" }, 400);
        }
        const nuevo = { id: siguienteLogoId++, name, createdAt: new Date().toISOString(), createdBy: autor, useCount: 0, lastUsedAt: null, imageDataUrl, thumbnailDataUrl };
        logos.push(nuevo);
        return send(resumenLogo(nuevo), 201);
      }
      const existente = logos.find((l) => l.id === id);
      if (!existente) return send({ message: "Logo no encontrado" }, 404);
      if (accion === "image" && req.method === "GET") return send({ dataUrl: existente.imageDataUrl });
      if (accion === "thumbnail" && req.method === "GET") return send({ dataUrl: existente.thumbnailDataUrl });
      if (accion === "use" && req.method === "POST") {
        existente.useCount += 1;
        existente.lastUsedAt = new Date().toISOString();
        return res.writeHead(204).end();
      }
      if (!accion && req.method === "PATCH") {
        existente.name = JSON.parse(body || "{}").name ?? existente.name;
        return send(resumenLogo(existente));
      }
      if (!accion && req.method === "DELETE") {
        logos = logos.filter((l) => l !== existente);
        return res.writeHead(204).end();
      }
    }

    // Mockups de un pedido: lista, alta, detalle y baja.
    const mockupsDe = path.match(/^\/orders\/(\d+)\/mockups(?:\/(\d+))?$/);
    if (mockupsDe) {
      const orderId = Number(mockupsDe[1]);
      const mockupId = mockupsDe[2] ? Number(mockupsDe[2]) : null;
      if (!pedidos().some((p) => p.id === orderId)) return send({ message: "Pedido no encontrado" }, 404);
      if (mockupId === null && req.method === "GET") {
        return send(mockups.filter((m) => m.orderId === orderId).map(resumenMockup));
      }
      if (mockupId === null && req.method === "POST") {
        const payload = JSON.parse(body || "{}");
        recibidos.push({ orderId, ...payload });
        if (!payload.garment || typeof payload.imageDataUrl !== "string") {
          return send({ message: "garment e imageDataUrl son obligatorios" }, 400);
        }
        // Mismas reglas que el backend (src/common/mockup-garments.ts): prendas
        // conocidas y `config.vehiclePart` ('full' | 'cab' | 'box') sólo en el tráiler.
        if (!PRENDAS_MOCKUP.includes(payload.garment)) {
          return send({ message: "La prenda no es válida" }, 400);
        }
        const parte = payload.config?.vehiclePart;
        if (parte !== undefined && (payload.garment !== "trailer" || !["full", "cab", "box"].includes(parte))) {
          return send({ message: "La parte del tráiler debe ser completo (full), cabina (cab) o caja (box)" }, 400);
        }
        const nuevo = {
          id: siguienteMockupId++,
          orderId,
          garment: payload.garment,
          dataUrl: payload.imageDataUrl,
          config: payload.config,
          createdAt: new Date().toISOString(),
          createdBy: { id: 1, name: "Rita Ponce" },
        };
        mockups.push(nuevo);
        return send(resumenMockup(nuevo), 201);
      }
      const existente = mockups.find((m) => m.orderId === orderId && m.id === mockupId);
      if (!existente) return send({ message: "Mockup no encontrado" }, 404);
      if (req.method === "GET") return send(existente);
      if (req.method === "DELETE") {
        mockups = mockups.filter((m) => m !== existente);
        return send({ ok: true });
      }
    }

    // Inventario: artículos, códigos de barras y movimientos (escaneo incluido).
    if (req.method === "POST" && path === "/__e2e/reset-inventory") {
      inventario = inventarioInicial();
      movimientosInventario = [];
      solicitudesReabasto = [];
      siguienteArticuloId = 4;
      return send({ ok: true });
    }
    const quien = usuarioDe(req);
    const misAreas = areasDe(quien);
    const esGestor = quien.roles.some((x) => GESTORES.includes(x.name));
    if (path.startsWith("/inventory") && esSucursal(quien)) {
      llamadasProhibidas.inventory++;
      return send({ message: "Forbidden" }, 403);
    }
    if (path.startsWith("/inventory") && misAreas.length === 0 && !esGestor) return send({ message: "Forbidden" }, 403);
    if (path === "/inventory/areas" && req.method === "GET") return send(misAreas);
    if (path === "/inventory/movements" && req.method === "GET") {
      if (!esGestor) return send({ message: "Forbidden" }, 403);
      return send(movimientosInventario);
    }
    if (path === "/inventory/restock-requests/count" && req.method === "GET") {
      const mias = solicitudesReabasto.filter((x) => misAreas.includes(x.area));
      return send({ pending: mias.filter((x) => x.status === "PENDIENTE").length, open: mias.filter((x) => x.status !== "RESUELTO").length });
    }
    if (path === "/inventory/restock-requests" && req.method === "GET") {
      const st = url.searchParams.get("status");
      const abiertas = url.searchParams.get("open") === "true";
      return send(solicitudesReabasto.filter((x) => misAreas.includes(x.area) && (!st || x.status === st) && (!abiertas || x.status !== "RESUELTO")));
    }
    if (path === "/inventory/restock-requests" && req.method === "POST") {
      const dto = JSON.parse(body || "{}");
      const art = dto.itemId ? inventario.find((a) => a.id === dto.itemId) : null;
      if (dto.itemId && (!art || !misAreas.includes(art.area))) return send({ message: "No tienes acceso al inventario de ese departamento" }, 403);
      const nueva = {
        id: siguienteSolicitudId++, area: art ? art.area : dto.area ?? misAreas[0], itemId: art?.id ?? null,
        itemName: art ? art.name : dto.itemName, quantity: dto.quantity ?? null, unit: dto.unit ?? art?.unit ?? null,
        comment: dto.comment ?? null, urgency: dto.urgency ?? "NORMAL", status: "PENDIENTE", statusNote: null,
        resolvedAt: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        item: art ? { id: art.id, name: art.name, unit: art.unit, quantity: art.quantity, area: art.area } : null,
        requestedBy: { id: quien.id, firstName: quien.firstName, lastName: quien.lastName }, handledBy: null,
      };
      solicitudesReabasto.unshift(nueva);
      return send(nueva, 201);
    }
    const solicitud = path.match(/^\/inventory\/restock-requests\/(\d+)$/);
    if (solicitud && req.method === "PATCH") {
      if (!esGestor) return send({ message: "Forbidden" }, 403);
      const x = solicitudesReabasto.find((y) => y.id === Number(solicitud[1]));
      if (!x) return send({ message: "La solicitud no existe" }, 404);
      const dto = JSON.parse(body || "{}");
      Object.assign(x, { status: dto.status, statusNote: dto.note ?? null, handledBy: { id: quien.id, firstName: quien.firstName, lastName: quien.lastName }, updatedAt: new Date().toISOString() });
      return send(x);
    }
    const porCodigo = path.match(/^\/inventory\/items\/by-barcode\/([^/]+)(\/movements)?$/);
    if (porCodigo) {
      const code = decodeURIComponent(porCodigo[1]).trim();
      if (code.length < 3 || code.length > 64 || !/^[\x20-\x7E]+$/.test(code)) {
        return send({ message: `Código de barras inválido: ${code}` }, 400);
      }
      const articulo = inventario.find((a) => (a.barcode ?? codigoPorOmision(a.id)) === code);
      if (!articulo || !misAreas.includes(articulo.area)) return send({ message: `No hay ningún artículo con el código ${code}` }, 404);
      if (!porCodigo[2] && req.method === "GET") return send(articuloJson(articulo));
      if (porCodigo[2] && req.method === "POST") {
        const dto = JSON.parse(body || "{}");
        if (!esGestor && dto.type === "AJUSTE") return send({ message: "Las áreas sólo pueden registrar entradas o consumos" }, 403);
        const r = registrarMovimiento(articulo, dto, quien);
        return send(r.body, r.status);
      }
    }
    const inventarioDe = path.match(/^\/inventory(?:\/(\d+)(\/movements)?)?$/);
    if (inventarioDe) {
      const id = inventarioDe[1] ? Number(inventarioDe[1]) : null;
      if (id === null && req.method === "GET") {
        const area = url.searchParams.get("area");
        if (area && !misAreas.includes(area)) return send({ message: "No tienes acceso al inventario de ese departamento" }, 403);
        return send(inventario.filter((a) => misAreas.includes(a.area) && (!area || a.area === area)).map(articuloJson));
      }
      if (!esGestor && (req.method !== "GET" || inventarioDe[2]) && !(inventarioDe[2] && req.method === "POST")) {
        return send({ message: "Forbidden" }, 403);
      }
      if (id === null && req.method === "POST") {
        const { initialQuantity = 0, barcode, ...datos } = JSON.parse(body || "{}");
        let code = null;
        if (barcode) {
          const v = validarCodigo(barcode);
          if (v.error) return send({ message: v.error }, v.status);
          code = v.code;
        }
        const nuevo = { sku: null, category: null, color: null, brand: null, location: null, minStock: null, unitCost: null, notes: null, materialId: null, supplierId: null, ...datos, id: siguienteArticuloId++, barcode: code, quantity: 0 };
        inventario.push(nuevo);
        if (initialQuantity > 0) registrarMovimiento(nuevo, { type: "ENTRADA", quantity: initialQuantity, note: "Stock inicial" });
        return send(articuloJson(nuevo), 201);
      }
      const articulo = inventario.find((a) => a.id === id);
      if (!articulo) return send({ message: "Artículo no encontrado" }, 404);
      if (!misAreas.includes(articulo.area)) return send({ message: "No tienes acceso al inventario de ese departamento" }, 403);
      if (inventarioDe[2] && req.method === "GET") return send(movimientosInventario.filter((m) => m.itemId === id));
      if (inventarioDe[2] && req.method === "POST") {
        const dto = JSON.parse(body || "{}");
        if (!esGestor && dto.type === "AJUSTE") return send({ message: "Las áreas sólo pueden registrar entradas o consumos" }, 403);
        const r = registrarMovimiento(articulo, dto, quien);
        return send(r.body, r.status);
      }
      if (req.method === "GET") return send(articuloJson(articulo));
      if (req.method === "PATCH") {
        const { barcode, ...datos } = JSON.parse(body || "{}");
        if (barcode !== undefined) {
          if (barcode === null || barcode === "") datos.barcode = null;
          else {
            const v = validarCodigo(barcode, id);
            if (v.error) return send({ message: v.error }, v.status);
            datos.barcode = v.code === codigoPorOmision(id) ? null : v.code;
          }
        }
        Object.assign(articulo, datos);
        return send(articuloJson(articulo));
      }
      if (req.method === "DELETE") {
        inventario = inventario.filter((a) => a !== articulo);
        return res.writeHead(204).end();
      }
    }

    // Avance de una tarea de área: es lo que el flujo 3 verifica.
    const avance = path.match(/^\/orders\/\d+\/area-tasks\/(\d+)\/status$/);
    if (avance && Number(avance[1]) === 90 && req.method === "PATCH") {
      const { status } = JSON.parse(body || "{}");
      aplicarInsumos(tareaAutorizar().status, status);
      autorizar.tarea = { ...tareaAutorizar(), status, supply: autorizar.supply };
      return send(autorizar.tarea);
    }
    if (avance && req.method === "PATCH") {
      const id = Number(avance[1]);
      const { status } = JSON.parse(body || "{}");
      // Como el backend: empezar una tarea libre la deja a nombre de quien la empieza.
      const u = usuarioDe(req);
      const avanzar = (t) => {
        if (t.id !== id) return t;
        const libre = t.assignedUserId == null || t.assignedUser?.isSharedAccount;
        const reclama = status === "en_proceso" && libre && u.roles.some((r) => r.name === t.area);
        return {
          ...t,
          status,
          ...(reclama && { assignedUserId: u.id, assignedUser: u }),
          ...(status === "en_proceso" && { startedAt: new Date().toISOString() }),
          ...(status === "terminado" && { completedAt: new Date().toISOString() }),
        };
      };
      tareas = tareas.map(avanzar);
      tareasTv = tareasTv.map(avanzar);
      return send([...tareas, ...tareasTv].find((t) => t.id === id));
    }

    // Hoja de autorización: rondas de diseño y sus archivos (sólo lectura).
    const rondas = path.match(/^\/orders\/(\d+)\/design-revisions(?:\/(\d+)\/(montage|files\/(\d+)))?$/);
    if (rondas && req.method === "GET") {
      const lista = rondasDiseno[Number(rondas[1])] ?? [];
      if (!rondas[2]) return send(lista);
      const r = lista.find((x) => x.id === Number(rondas[2]));
      const fileId = rondas[3] === "montage" ? r?.montageFiles[0]?.id : Number(rondas[4]);
      const archivo = r?.montageFiles.some((f) => f.id === fileId) ? archivosDiseno[fileId] : null;
      return archivo ? send(archivo) : send({ message: "Archivo de la ronda no encontrado" }, 404);
    }

    // ── Sucursales ──────────────────────────────────────────────────────────
    // (`quien` ya está declarado arriba, en el bloque de Inventario.)
    if (req.method === "POST" && path === "/__e2e/reset-branches") {
      hojasPedidasPorSucursal = 0;
      sucursales = sucursalesIniciales();
      pedidosSucursalCreados = [];
      siguientePedidoSucursalId = 200;
      clientes = clientesIniciales();
      siguienteClienteId = 50;
      presetsProducto = [];
      siguientePresetId = 1;
      llamadasProhibidas = { inventory: 0, companies: 0 };
      preferencias = { ...PREFERENCIAS_INICIALES };
      return send({ ok: true });
    }
    if (req.method === "GET" && path === "/__e2e/clients") return send(clientes);
    if (req.method === "GET" && path === "/__e2e/presets") return send(presetsProducto);
    if (req.method === "GET" && path === "/__e2e/forbidden-calls") return send(llamadasProhibidas);
    if (req.method === "POST" && path === "/__e2e/seed-branch-orders") {
      const { count = 25 } = JSON.parse(body || "{}");
      for (let i = 1; i <= count; i++) {
        const entregado = i % 2 === 0;
        pedidosSucursalCreados.push({
          id: siguientePedidoSucursalId++, statusId: entregado ? 5 : 1, status: { id: entregado ? 5 : 1, name: entregado ? "entregado" : "pendiente" },
          clientNameOverride: `Cliente ${i}`, description: `Pedido de prueba ${i}`,
          creationDate: new Date(Date.UTC(2026, 7, 1, 12) + i * 86_400_000).toISOString(), deliveryDate: null,
          deliveredAt: entregado ? "2026-09-01T12:00:00.000Z" : null, area: "taller", requiresDesign: false, areaTasks: [], orderProducts: [],
          assignedUser: null, branchId: 1, branch: { id: 1, name: "Punto Madero" },
          branchEmployeeId: 1, branchEmployee: { id: 1, name: "Ana López" },
        });
      }
      return send({ ok: true, total: pedidosSucursalCreados.length });
    }

    // Empresas: no son de la sucursal (y la pantalla no debe ni pedirlas).
    if (path === "/companies" && esSucursal(quien)) {
      llamadasProhibidas.companies++;
      return send({ message: "Forbidden" }, 403);
    }

    // Clientes: la sucursal sólo ve/crea/edita los suyos; la matriz ve todos (`?branchId=` filtra).
    {
      const ruta = path.match(/^\/clients(?:\/(\d+))?$/);
      if (ruta) {
        const datos = () => JSON.parse(body || "{}");
        const id = ruta[1] ? Number(ruta[1]) : null;
        if (id === null && req.method === "GET") {
          const branchId = url.searchParams.get("branchId");
          return send(
            clientes.filter((c) => (esSucursal(quien) ? c.branchId === quien.branchId : !branchId || String(c.branchId) === branchId))
          );
        }
        if (id === null && req.method === "POST") {
          const dto = datos();
          if (!dto.first_name?.trim()) return send({ message: "El nombre es requerido" }, 400);
          const b = esSucursal(quien) ? sucursales.find((x) => x.id === quien.branchId) : null;
          const nuevo = {
            id: siguienteClienteId++, first_name: dto.first_name, last_name: dto.last_name ?? "", phone: dto.phone ?? null,
            email: dto.email ?? null, address: dto.address ?? null, companyId: b ? null : dto.companyId ?? null, company: null,
            // La sucursal NO manda branchId: el backend lo liga a la suya.
            branchId: b ? b.id : null, branch: b ? { id: b.id, name: b.name } : null,
          };
          clientes.push(nuevo);
          return send(nuevo, 201);
        }
        if (id !== null && ["GET", "PATCH", "DELETE"].includes(req.method)) {
          const c = clientes.find((x) => x.id === id);
          if (!c || (esSucursal(quien) && c.branchId !== quien.branchId)) return send({ message: "Cliente no encontrado" }, 404);
          if (req.method === "GET") return send(c);
          if (req.method === "DELETE") {
            if (esSucursal(quien)) return send({ message: "Sin permisos para eliminar clientes" }, 403);
            clientes = clientes.filter((x) => x !== c);
            return res.writeHead(204).end();
          }
          const cambios = datos();
          delete cambios.branchId;
          Object.assign(c, cambios);
          return send(c);
        }
      }
    }

    // Productos frecuentes: el alta es idempotente (devuelve el existente).
    if (path === "/order-product-presets" && req.method === "GET") {
      return send([...presetsProducto].sort((a, b) => (b.uses ?? 0) - (a.uses ?? 0) || a.id - b.id));
    }
    if (path === "/order-product-presets" && req.method === "POST") {
      const name = String(JSON.parse(body || "{}").name ?? "").replace(/\s+/g, " ").trim();
      if (name.length < 1 || name.length > 80) return send({ message: "El nombre debe tener entre 1 y 80 caracteres" }, 400);
      if (clavePreset(name) === "prohibido") return send({ message: "Ese nombre de producto no está permitido" }, 400);
      const existente = presetsProducto.find((p) => clavePreset(p.name) === clavePreset(name));
      if (existente) return send(existente, 200);
      const nuevo = { id: siguientePresetId++, name, uses: 0 };
      presetsProducto.push(nuevo);
      return send(nuevo, 201);
    }
    if (req.method === "GET" && path === "/__e2e/branch-orders") return send(pedidosSucursalCreados);
    if (req.method === "GET" && path === "/roles") return send(roles);
    if (req.method === "GET" && path === "/branches/me") {
      const b = sucursales.find((x) => x.id === quien.branchId);
      if (!esSucursal(quien) || !b) return send({ message: "Sin permisos para acceder a esta sección" }, 403);
      return send({ id: b.id, name: b.name, active: b.active, employees: b.employees.filter((e) => e.active).map(({ id, name }) => ({ id, name })) });
    }
    if (path.startsWith("/branches") && esSucursal(quien)) {
      return send({ message: "Sin permisos para acceder a esta sección" }, 403);
    }
    if (req.method === "GET" && path === "/branches") return send(sucursales);
    if (req.method === "POST" && path === "/branches") {
      const { name } = JSON.parse(body || "{}");
      const nueva = { id: sucursales.length + 1, name, active: true, employees: [] };
      sucursales.push(nueva);
      return send(nueva, 201);
    }
    const sucursalRuta = path.match(/^\/branches\/(\d+)(?:\/employees(?:\/(\d+))?)?$/);
    if (sucursalRuta) {
      const b = sucursales.find((x) => x.id === Number(sucursalRuta[1]));
      if (!b) return send({ message: "Sucursal no encontrada" }, 404);
      const datos = JSON.parse(body || "{}");
      if (path.endsWith("/employees") && req.method === "POST") {
        if (b.employees.some((e) => e.name === datos.name)) return send({ message: "Ya hay un empleado con ese nombre en la sucursal" }, 409);
        const nuevo = { id: siguienteEmpleadoId++, branchId: b.id, name: datos.name, active: true };
        b.employees.push(nuevo);
        return send(nuevo, 201);
      }
      if (sucursalRuta[2] && req.method === "PATCH") {
        const e = b.employees.find((x) => x.id === Number(sucursalRuta[2]));
        if (!e) return send({ message: "Empleado no encontrado" }, 404);
        Object.assign(e, datos);
        return send(e);
      }
      if (!path.includes("/employees") && req.method === "PATCH") {
        Object.assign(b, datos);
        return send(b);
      }
    }

    // Pedidos: la sucursal sólo ve (y levanta) los suyos; el empleado es obligatorio.
    if (path === "/orders" && req.method === "GET" && esSucursal(quien)) {
      const propios = pedidos().filter((p) => p.branchId === quien.branchId);
      // Sin parámetros: lista plana (Mis pedidos). Con `page`/`limit`/filtros: historial paginado.
      if (!["page", "limit", "q", "statusId", "from", "to"].some((k) => url.searchParams.has(k))) return send(propios);
      const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
      const statusId = Number(url.searchParams.get("statusId")) || null;
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      const filtrados = propios
        .filter((p) => !statusId || p.statusId === statusId)
        .filter((p) => !from || new Date(p.creationDate) >= new Date(from))
        .filter((p) => !to || new Date(p.creationDate) <= new Date(to))
        .filter((p) => !q || `${p.id} ${p.clientNameOverride ?? ""} ${p.description ?? ""}`.toLowerCase().includes(q))
        .sort((a, b) => new Date(b.creationDate) - new Date(a.creationDate) || b.id - a.id);
      const limit = Number(url.searchParams.get("limit")) || 20;
      const page = Number(url.searchParams.get("page")) || 1;
      return send({
        data: filtrados.slice((page - 1) * limit, page * limit),
        meta: { total: filtrados.length, page, limit, totalPages: Math.max(1, Math.ceil(filtrados.length / limit)) },
      });
    }
    if (path === "/orders" && req.method === "POST") {
      const dto = JSON.parse(body || "{}");
      if (esSucursal(quien)) {
        if (!dto.branchEmployeeId) return send({ message: "Elige qué empleado de la sucursal levanta el pedido" }, 400);
        const b = sucursales.find((x) => x.id === quien.branchId);
        const e = b?.employees.find((x) => x.id === dto.branchEmployeeId);
        if (!e) return send({ message: "El empleado no pertenece a la sucursal" }, 400);
        if (!e.active) return send({ message: "El empleado está inactivo" }, 400);
        const cliente = dto.clientId ? clientes.find((c) => c.id === dto.clientId && c.branchId === b.id) : null;
        if (dto.clientId && !cliente) return send({ message: "El cliente no pertenece a la sucursal" }, 400);
        const creado = {
          id: siguientePedidoSucursalId++, statusId: 6, status: { id: 6, name: "en diseño" },
          clientId: cliente?.id ?? null, client: cliente ?? null,
          clientNameOverride: cliente ? null : dto.clientNameOverride ?? "Cliente", description: dto.description,
          creationDate: new Date().toISOString(), deliveryDate: dto.deliveryDate ?? null, deliveredAt: null,
          area: "diseno", requiresDesign: true, areaTasks: [], orderProducts: dto.orderProducts ?? [],
          assignedUser: usuarios[2], branchId: b.id, branch: { id: b.id, name: b.name },
          branchEmployeeId: e.id, branchEmployee: { id: e.id, name: e.name },
        };
        pedidosSucursalCreados.push(creado);
        return send(creado, 201);
      }
      // Pedido de la matriz: se registra tal cual llegó (lo consulta /__e2e/orders).
      pedidosCreados.push(dto);
      return send({ id: 777, ...dto }, 201);
    }
    {
      const ped = path.match(/^\/orders\/(\d+)(?:\/|$)/);
      if (ped && esSucursal(quien) && req.method === "GET") {
        const propio = pedidos().find((p) => p.id === Number(ped[1]) && p.branchId === quien.branchId);
        if (!propio) return send({ message: "Sin acceso a este pedido" }, 403);
      }
    }

    // Detalle de un pedido (también los del Modo TV, que no están en GET /orders).
    const detalle = path.match(/^\/orders\/(\d+)$/);
    if (detalle && req.method === "GET") {
      const id = Number(detalle[1]);
      if (id === ORDEN_AUTORIZAR) return send(pedidoAutorizar());
      const pedido = pedidos().find((p) => p.id === id);
      if (pedido) return send(pedido);
      const tv = tareasTv.find((t) => t.orderId === id);
      if (tv) {
        return send({
          ...tv.order, deliveredAt: null, area: tv.area, productionArea: tv.area, requiresDesign: true,
          areaTasks: tareasTv.filter((t) => t.orderId === id).map(({ order, ...t }) => t), orderProducts: [], assignedUser: null,
        });
      }
      return send({ message: "Pedido no encontrado" }, 404);
    }

    const match = rutas[`${req.method} ${path}`];
    if (match) return send(match());
    const tareasDe = path.match(/^\/orders\/(\d+)\/area-tasks$/);
    if (tareasDe) {
      const id = Number(tareasDe[1]);
      return send([...tareas, ...tareasTv].filter((t) => t.orderId === id).map(({ order, ...t }) => t));
    }
    if (req.method === "GET") return send([]);
    return send({}, 200);
  });
}).listen(PORT, () => console.log(`mock api en http://localhost:${PORT}`));
