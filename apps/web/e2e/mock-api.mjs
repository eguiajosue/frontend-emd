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
 * - `GET  /__e2e/mockups`: los POST de mockups recibidos, tal cual llegaron.
 * - `POST /__e2e/reset`:   vacía mockups, plantillas, logos y "Mis colores".
 * - `GET  /__e2e/preferences`: las preferencias guardadas (p. ej. `mockupColors`).
 * - `GET  /__e2e/mockup-templates`: plantillas guardadas, con su config.
 * - `GET  /__e2e/quotes`: las cotizaciones en memoria (para verificar lo guardado).
 * - `POST /__e2e/reset-preferences`: vuelve las preferencias al estado inicial
 *   (barra lateral por defecto: `navPreferences: null`).
 */
import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_API_PORT ?? 4010);

const usuarios = [
  { id: 1, username: "recepcion1", firstName: "Rita", lastName: "Ponce", isSharedAccount: false, roles: [{ id: 1, name: "recepcion" }] },
  { id: 2, username: "bordado", firstName: "Bordado", lastName: "", isSharedAccount: true, roles: [{ id: 2, name: "bordado" }] },
  { id: 3, username: "jeguia1", firstName: "José", lastName: "Eguía", isSharedAccount: false, roles: [{ id: 3, name: "diseno" }, { id: 2, name: "bordado" }] },
];

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
let tareas = [{ id: 1, orderId: 101, area: "bordado", status: "pendiente", assignedUserId: 2, createdAt: "2026-09-01T10:00:00.000Z", assignedUser: usuarios[1] }];

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
    orderProducts: [{ customName: "Polo", quantity: 24 }],
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

const rutas = {
  "GET /orders": () => pedidos(),
  "GET /status": () => estados,
  "GET /users": () => usuarios,
  "GET /clients": () => [],
  "GET /settings": () => ({ deliveredRetentionHours: 72 }),
  "GET /notifications/unread-count": () => ({ unreadCount: 0 }),
  // Tour de bienvenida ya visto: si no, su capa (fixed, z-110) tapa la
  // pantalla y se come los clicks de los tests.
  "GET /users/me/preferences": () => preferencias,
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

    // Ganchos sólo para los tests.
    if (req.method === "POST" && path === "/__e2e/reset-preferences") {
      preferencias = { ...PREFERENCIAS_INICIALES };
      return send(preferencias);
    }
    if (req.method === "GET" && path === "/__e2e/mockups") return send(recibidos);
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

    // Avance de una tarea de área: es lo que el flujo 3 verifica.
    const avance = path.match(/^\/orders\/\d+\/area-tasks\/(\d+)\/status$/);
    if (avance && req.method === "PATCH") {
      const id = Number(avance[1]);
      const { status } = JSON.parse(body || "{}");
      tareas = tareas.map((t) => (t.id === id ? { ...t, status } : t));
      return send(tareas.find((t) => t.id === id));
    }

    // Detalle de un pedido.
    const detalle = path.match(/^\/orders\/(\d+)$/);
    if (detalle && req.method === "GET") {
      const pedido = pedidos().find((p) => p.id === Number(detalle[1]));
      return pedido ? send(pedido) : send({ message: "Pedido no encontrado" }, 404);
    }

    const match = rutas[`${req.method} ${path}`];
    if (match) return send(match());
    if (path.startsWith("/orders/") && path.endsWith("/area-tasks")) return send(tareas);
    if (req.method === "GET") return send([]);
    return send({}, 200);
  });
}).listen(PORT, () => console.log(`mock api en http://localhost:${PORT}`));
