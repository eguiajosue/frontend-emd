/**
 * Backend de mentira para los tests end-to-end.
 *
 * Los e2e no pueden apuntar al backend real: necesitan datos estables y correr
 * sin red. Y no alcanza con interceptar desde el navegador, porque next-auth
 * hace el login desde el servidor de Next, no desde la página: esa request
 * nunca pasa por Playwright. Así que se levanta un backend mínimo y se apunta
 * `NEXT_PUBLIC_BACKEND_URL` acá.
 *
 * Sólo implementa lo que los tres flujos tocan. Cualquier otra ruta devuelve
 * una lista vacía, que es lo que la app espera de un catálogo sin datos.
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

const rutas = {
  "POST /auth/login": () => ({
    id: 1, username: "recepcion1", token: token(), refreshToken: token(),
    first_name: "Rita", last_name: "Ponce", roles: ["recepcion"],
  }),
  "GET /orders": () => pedidos(),
  "GET /status": () => estados,
  "GET /users": () => usuarios,
  "GET /clients": () => [],
  "GET /settings": () => ({ deliveredRetentionHours: 72 }),
  "GET /notifications/unread-count": () => ({ unreadCount: 0 }),
};

/** JWT sin firmar de verdad: sólo necesita un `exp` futuro que `jose` pueda leer. */
function token() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: 1, username: "recepcion1", roles: ["recepcion"], exp })}.firma-de-mentira`;
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

    // Avance de una tarea de área: es lo que el flujo 3 verifica.
    const avance = path.match(/^\/orders\/\d+\/area-tasks\/(\d+)\/status$/);
    if (avance && req.method === "PATCH") {
      const id = Number(avance[1]);
      const { status } = JSON.parse(body || "{}");
      tareas = tareas.map((t) => (t.id === id ? { ...t, status } : t));
      return send(tareas.find((t) => t.id === id));
    }

    const match = rutas[`${req.method} ${path}`];
    if (match) return send(match());
    if (path.startsWith("/orders/") && path.endsWith("/area-tasks")) return send(tareas);
    if (req.method === "GET") return send([]);
    return send({}, 200);
  });
}).listen(PORT, () => console.log(`mock api en http://localhost:${PORT}`));
