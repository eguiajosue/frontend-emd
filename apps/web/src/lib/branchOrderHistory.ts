import type { Paginated } from "@/lib/api";
import { getOrderClientName } from "@/lib/format";
import type { Order } from "@/types";

/**
 * Historial propio de la sucursal: `GET /orders` (el backend ya lo limita a su
 * sucursal) con búsqueda, estado, rango de fechas de CREACIÓN y paginación.
 *
 * TODO lo que depende del contrato con el backend vive aquí (nombres de los
 * parámetros, tamaño de página y forma de la respuesta), para ajustarlo en un
 * solo lugar si el backend lo cambia.
 */

/** Pedidos por página del historial. */
export const BRANCH_HISTORY_PAGE_SIZE = 20;

/** Nombres de los query params de `GET /orders` según el contrato. */
export const BRANCH_HISTORY_PARAMS = {
  search: "q",
  statusId: "statusId",
  from: "from",
  to: "to",
  page: "page",
  limit: "limit",
} as const;

/** Filtros tal como los edita la pantalla (fechas "yyyy-MM-dd" del input). */
export interface BranchHistoryFilters {
  q: string;
  statusId?: number;
  from: string;
  to: string;
}

export const EMPTY_BRANCH_HISTORY_FILTERS: BranchHistoryFilters = { q: "", statusId: undefined, from: "", to: "" };

export function hasBranchHistoryFilters(f: BranchHistoryFilters): boolean {
  return Boolean(f.q.trim() || f.statusId || f.from || f.to);
}

/** Inicio del día local en ISO (el `to` va al final del día, para incluirlo completo). */
function startOfDayIso(day: string): string | undefined {
  if (!day) return undefined;
  const d = new Date(`${day}T00:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}
function endOfDayIso(day: string): string | undefined {
  if (!day) return undefined;
  const d = new Date(`${day}T23:59:59.999`);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** Query params de `GET /orders` (sin los vacíos). */
export function buildBranchHistoryParams(
  filters: BranchHistoryFilters,
  page: number,
  limit = BRANCH_HISTORY_PAGE_SIZE
): Record<string, string | number> {
  const P = BRANCH_HISTORY_PARAMS;
  const params: Record<string, string | number> = { [P.page]: page, [P.limit]: limit };
  const q = filters.q.trim();
  if (q) params[P.search] = q;
  if (filters.statusId) params[P.statusId] = filters.statusId;
  const from = startOfDayIso(filters.from);
  const to = endOfDayIso(filters.to);
  if (from) params[P.from] = from;
  if (to) params[P.to] = to;
  return params;
}

export interface BranchHistoryPage {
  orders: Order[];
  total: number;
  page: number;
  totalPages: number;
}

const byCreationDesc = (a: Order, b: Order) =>
  new Date(b.creationDate ?? 0).getTime() - new Date(a.creationDate ?? 0).getTime() || b.id - a.id;

/** Texto sin acentos ni mayúsculas, para buscar. */
function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Filtra en el cliente (sólo cuando el backend contesta un array plano, sin filtros propios). */
export function filterOrdersLocally(orders: Order[], filters: BranchHistoryFilters): Order[] {
  const q = fold(filters.q.trim());
  const from = startOfDayIso(filters.from);
  const to = endOfDayIso(filters.to);
  return orders.filter((o) => {
    if (filters.statusId && o.statusId !== filters.statusId) return false;
    if (from && new Date(o.creationDate ?? 0).getTime() < new Date(from).getTime()) return false;
    if (to && new Date(o.creationDate ?? 0).getTime() > new Date(to).getTime()) return false;
    if (q) {
      const hay = fold(`${o.id} ${getOrderClientName(o)} ${o.description ?? ""}`);
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/**
 * Normaliza la respuesta de `GET /orders`:
 *  - `{ data, meta }` (paginado por el backend): se usa tal cual.
 *  - array plano (backend sin paginar todavía): se filtra, ordena y pagina aquí.
 * En ambos casos queda ordenado por fecha de creación, más nuevo primero.
 */
export function parseBranchOrderHistory(
  payload: Order[] | Paginated<Order> | null | undefined,
  filters: BranchHistoryFilters,
  page: number,
  limit = BRANCH_HISTORY_PAGE_SIZE
): BranchHistoryPage {
  if (Array.isArray(payload)) {
    const all = filterOrdersLocally(payload, filters).sort(byCreationDesc);
    const totalPages = Math.max(1, Math.ceil(all.length / limit));
    const current = Math.min(Math.max(1, page), totalPages);
    return {
      orders: all.slice((current - 1) * limit, current * limit),
      total: all.length,
      page: current,
      totalPages,
    };
  }
  const rows = Array.isArray(payload?.data) ? [...payload.data].sort(byCreationDesc) : [];
  const meta = payload?.meta ?? {};
  const total = meta.total ?? rows.length;
  const size = meta.limit ?? meta.pageSize ?? limit;
  return {
    orders: rows,
    total,
    page: meta.page ?? page,
    totalPages: meta.totalPages ?? Math.max(1, Math.ceil(total / size)),
  };
}
