import type { Order } from "@/types";

/**
 * Filtro "Origen" de los pedidos (sólo roles de matriz): de dónde salió cada
 * pedido. `undefined` = Todos.
 *
 *  - "matriz":   pedidos levantados en la matriz (sin sucursal).
 *  - "sucursal": pedidos de CUALQUIER sucursal ("Todas las sucursales").
 *  - "<id>":     pedidos de esa sucursal (string numérico: es lo que viaja en la URL).
 */
export type OrderOrigin = "matriz" | "sucursal" | `${number}`;

/** Nombre del query param en la URL de la pantalla: `?origen=matriz|sucursal|<id>`. */
export const ORIGIN_URL_PARAM = "origen";

export function parseOrigin(value: string | null | undefined): OrderOrigin | undefined {
  if (!value) return undefined;
  if (value === "matriz" || value === "sucursal") return value;
  return /^\d+$/.test(value) && Number(value) > 0 ? (value as `${number}`) : undefined;
}

/**
 * Query params de `GET /orders` (y `/orders/history`) para el origen:
 * "Todos" = ninguno, "Matriz" = `origin=matriz`, "Todas las sucursales" =
 * `origin=sucursal`, una sucursal = `branchId=N`.
 */
export function originParams(origin: OrderOrigin | undefined): { origin?: string; branchId?: number } {
  if (!origin) return {};
  if (origin === "matriz" || origin === "sucursal") return { origin };
  return { branchId: Number(origin) };
}

/** Red de seguridad en el cliente (por si el backend aún no filtra): ¿el pedido cumple el origen? */
export function matchesOrigin(order: Pick<Order, "branchId" | "branch">, origin: OrderOrigin | undefined): boolean {
  if (!origin) return true;
  const branchId = order.branchId ?? order.branch?.id ?? null;
  if (origin === "matriz") return branchId == null;
  if (origin === "sucursal") return branchId != null;
  return branchId === Number(origin);
}

export function originLabel(origin: OrderOrigin | undefined, branches: { id: number; name: string }[]): string {
  if (!origin) return "Todos";
  if (origin === "matriz") return "Matriz";
  if (origin === "sucursal") return "Todas las sucursales";
  return branches.find((b) => b.id === Number(origin))?.name ?? `Sucursal #${origin}`;
}
