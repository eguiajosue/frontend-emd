import { addDays, differenceInCalendarDays, endOfDay, format } from "date-fns";
import { es } from "date-fns/locale";
import { PRODUCTION_AREA_OPTIONS } from "@/lib/areas";
import { DATE_FORMAT, MAX_QUANTITY, clampName, normalizeProductKey, type RepeatMaterial } from "@/lib/createOrderForm";
import type { OrderProductRow } from "@/lib/createOrderPayload";
import type { Client, ClientInsights } from "@/types";

/**
 * Piezas puras del "Nuevo pedido" para gente que ya sabe cargar pedidos
 * (ver `CreateOrderDialog`): agregar con cantidad al frente ("50 playera"),
 * buscar clientes por nombre/teléfono/empresa, atajos de entrega, la ruta que
 * suele llevar el cliente y la memoria local (borrador, quién levanta, "crear
 * otro"). Sin React, para poder testearlas aparte.
 */

/* --------------------------- Agregar producto ---------------------------- */

/**
 * "50 playera" → 50 × "playera". Acepta "50x playera", "50 x playera" y
 * "50× playera". Un número pegado a letras ("3D figura") es parte del nombre.
 */
export function parseQuickAdd(text: string): { name: string; quantity?: number } {
  const match = text.match(/^\s*(\d{1,6})\s*[x×*]?\s+(\S.*?)\s*$/i);
  if (!match) return { name: clampName(text) };
  const quantity = Number(match[1]);
  const name = clampName(match[2] ?? "");
  if (!name || quantity < 1) return { name: clampName(text) };
  return { name, quantity: Math.min(quantity, MAX_QUANTITY) };
}

/**
 * Nombre de producto prolijo para la hoja de producción: si se escribió todo
 * en minúsculas ("playera bordada") arranca con mayúscula ("Playera bordada").
 * Lo que ya trae mayúsculas a propósito ("DTF", "iPhone") se respeta.
 */
export function tidyProductName(name: string): string {
  const clean = clampName(name);
  if (!clean || clean !== clean.toLocaleLowerCase("es")) return clean;
  return clean.charAt(0).toLocaleUpperCase("es") + clean.slice(1);
}

/* -------------------------------- Clientes ------------------------------- */

export function clientLabel(c: Pick<Client, "first_name" | "last_name">): string {
  return [c.first_name, c.last_name].filter(Boolean).join(" ");
}

function normalizeText(value: string): string {
  return normalizeProductKey(value);
}

const digitsOf = (value: string) => value.replace(/\D/g, "");

/** ¿El cliente coincide con lo escrito? Nombre, teléfono (sólo dígitos) o empresa. */
export function clientMatches(client: Client, query: string): boolean {
  const q = normalizeText(query);
  if (!q) return true;
  const haystack = normalizeText([clientLabel(client), client.company?.name ?? "", client.email ?? ""].join(" "));
  if (q.split(" ").every((word) => haystack.includes(word))) return true;
  const qDigits = digitsOf(query);
  return qDigits.length >= 3 && digitsOf(client.phone ?? "").includes(qDigits);
}

/**
 * Resultados del buscador de clientes. Sin texto: los recientes (o, si no
 * hay recientes todavía, los primeros de la lista). Con texto: los que
 * coinciden, primero los que EMPIEZAN con lo escrito.
 */
export function searchClients(
  clients: Client[],
  query: string,
  recentIds: number[],
  limit = 8
): { results: Client[]; showingRecents: boolean } {
  const q = normalizeText(query);
  if (!q) {
    const recents = recentIds
      .map((id) => clients.find((c) => c.id === id))
      .filter((c): c is Client => Boolean(c));
    if (recents.length > 0) return { results: recents.slice(0, limit), showingRecents: true };
    const sorted = [...clients].sort((a, b) => clientLabel(a).localeCompare(clientLabel(b), "es"));
    return { results: sorted.slice(0, limit), showingRecents: false };
  }
  const matches = clients.filter((c) => clientMatches(c, query));
  const starts = (c: Client) => (normalizeText(clientLabel(c)).startsWith(q) ? 0 : 1);
  matches.sort((a, b) => starts(a) - starts(b) || clientLabel(a).localeCompare(clientLabel(b), "es"));
  return { results: matches.slice(0, limit), showingRecents: false };
}

/** ¿Hay un cliente que se llama exactamente así? (para no ofrecer "Usar «X»" de más). */
export function hasExactClient(clients: Client[], query: string): boolean {
  const q = normalizeText(query);
  return Boolean(q) && clients.some((c) => normalizeText(clientLabel(c)) === q);
}

/* -------------------------------- Entrega -------------------------------- */

export type DeliveryChipKey = "today" | "tomorrow" | "habitual";

export interface DeliveryChip {
  key: DeliveryChipKey;
  /** Texto del chip ("Hoy", "Mañana", "jue 15"). */
  label: string;
  /** Detalle chico ("mar", "habitual"). */
  hint?: string;
  /** Nombre accesible completo ("Mañana, martes 14 de octubre"). */
  ariaLabel: string;
  date: string;
}

/**
 * Atajos de fecha: Hoy, Mañana y —si se conoce— la fecha a la que suele
 * pedir el cliente ("habitual"). Si la habitual cae hoy o mañana no se repite.
 */
export function deliveryChips(today: Date, leadDays: number | null): DeliveryChip[] {
  const at = (days: number) => addDays(today, days);
  const long = (d: Date) => format(d, "EEEE d 'de' MMMM", { locale: es });
  const tomorrow = at(1);
  const chips: DeliveryChip[] = [
    { key: "today", label: "Hoy", ariaLabel: `Hoy, ${long(today)}`, date: format(today, DATE_FORMAT) },
    {
      key: "tomorrow",
      label: "Mañana",
      hint: format(tomorrow, "EEE", { locale: es }).replace(".", ""),
      ariaLabel: `Mañana, ${long(tomorrow)}`,
      date: format(tomorrow, DATE_FORMAT),
    },
  ];
  if (leadDays !== null && leadDays >= 2) {
    const d = at(leadDays);
    chips.push({
      key: "habitual",
      label: format(d, "EEE d", { locale: es }).replace(".", ""),
      hint: "habitual",
      ariaLabel: `${long(d)} (su anticipación habitual)`,
      date: format(d, DATE_FORMAT),
    });
  }
  return chips;
}

/* ---------------------------------- Ruta --------------------------------- */

const PRODUCTION_AREA_VALUES: readonly string[] = PRODUCTION_AREA_OPTIONS.map((a) => a.value);

/**
 * Ruta con la que suele ir el cliente (para proponerla si el usuario no tocó
 * la ruta): la del pedido habitual si existe, si no la ruta aprendida, con
 * las áreas que aparecen en al menos un tercio de sus pedidos.
 */
export function routeFromInsights(
  insights: Pick<ClientInsights, "route" | "suggestion" | "ordersAnalyzed"> | null | undefined
): { requiresDesign: boolean; areas: string[] } | null {
  if (!insights) return null;
  const valid = (a: string) => PRODUCTION_AREA_VALUES.includes(a);
  if (insights.suggestion) {
    return {
      requiresDesign: insights.suggestion.requiresDesign,
      areas: insights.suggestion.areas.filter(valid).filter((a, i, all) => all.indexOf(a) === i).slice(0, 3),
    };
  }
  if (!insights.route || insights.ordersAnalyzed < 2) return null;
  const areas = [...insights.route.areas]
    .filter((a) => valid(a.area) && a.share >= 1 / 3)
    .sort((a, b) => b.share - a.share)
    .map((a) => a.area)
    .slice(0, 3);
  return { requiresDesign: insights.route.requiresDesign, areas };
}

/* ------------------------------ Tiempo corto ----------------------------- */

/** "hoy" · "ayer" · "hace 3 d" · "hace 2 meses" (chips de pedidos anteriores). */
export function shortAgo(iso: string | null | undefined, now: Date): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const days = differenceInCalendarDays(now, date);
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 60) return `hace ${days} d`;
  const months = Math.round(days / 30);
  return `hace ${months} meses`;
}

/** "hace un momento" · "hace 12 min" · "hace 2 h" (aviso de borrador). */
export function draftAgeLabel(savedAt: number, now: number): string {
  const minutes = Math.floor((now - savedAt) / 60_000);
  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes} min`;
  return `hace ${Math.floor(minutes / 60)} h`;
}

/* ------------------------------ Memoria local ---------------------------- */

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

function storageOrNull(storage?: StorageLike): StorageLike | null {
  if (storage) return storage;
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Borrador del alta: un pedido a medio cargar, por usuario. */
export const ORDER_DRAFT_PREFIX = "emd:orderDraft:v1:";
/** Quién levanta los pedidos en la sucursal (se recuerda hasta el fin del día). */
export const BRANCH_EMPLOYEE_PREFIX = "emd:branchEmployee:v1:";
/** Preferencia "Crear otro al terminar", por usuario. */
export const CREATE_ANOTHER_PREFIX = "emd:orderCreateAnother:v1:";
/** Un borrador más viejo que esto ya no se ofrece (y se borra). */
export const DRAFT_TTL_MS = 4 * 60 * 60 * 1000;

export type DraftBase =
  | { kind: "order"; id: number; snapshot: unknown }
  | { kind: "template"; id: number; name: string; snapshot: unknown }
  | { kind: "suggestion"; id: number; name: string; snapshot: unknown };

/** Lo que se guarda del formulario (nunca el archivo ni los mockups: pesan y no son serializables). */
export interface OrderDraftData {
  clientId?: number;
  clientNameOverride: string;
  clientLabel?: string;
  requiresDesign: boolean;
  areas: string[];
  assignedUserId?: number;
  description: string;
  deliveryDate: string;
  deliveryTime: string;
  rows: OrderProductRow[];
  materials: RepeatMaterial[];
  base: DraftBase | null;
  routeTouched: boolean;
  descriptionTouched: boolean;
}

export interface OrderDraft {
  version: 1;
  savedAt: number;
  data: OrderDraftData;
}

export function orderDraftKey(userId: string | number): string {
  return `${ORDER_DRAFT_PREFIX}${userId}`;
}

/** Borrador vigente del usuario; uno vencido o roto se borra y devuelve `null`. */
export function readOrderDraft(userId: string | number | undefined, now = Date.now(), storage?: StorageLike): OrderDraft | null {
  const store = storageOrNull(storage);
  if (!store || userId === undefined || userId === "") return null;
  const key = orderDraftKey(userId);
  try {
    const raw = store.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OrderDraft;
    const valid =
      parsed &&
      parsed.version === 1 &&
      typeof parsed.savedAt === "number" &&
      parsed.data &&
      Array.isArray(parsed.data.rows) &&
      typeof parsed.data.description === "string";
    if (!valid || now - parsed.savedAt > DRAFT_TTL_MS || parsed.savedAt > now + 60_000) {
      store.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    try {
      store.removeItem(key);
    } catch {
      // Sin acceso a localStorage: nada que limpiar.
    }
    return null;
  }
}

/** Guarda el borrador; devuelve `false` si no se pudo (modo privado, cuota). */
export function writeOrderDraft(
  userId: string | number | undefined,
  data: OrderDraftData,
  now = Date.now(),
  storage?: StorageLike
): boolean {
  const store = storageOrNull(storage);
  if (!store || userId === undefined || userId === "") return false;
  try {
    const draft: OrderDraft = { version: 1, savedAt: now, data };
    store.setItem(orderDraftKey(userId), JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function clearOrderDraft(userId: string | number | undefined, storage?: StorageLike) {
  const store = storageOrNull(storage);
  if (!store || userId === undefined || userId === "") return;
  try {
    store.removeItem(orderDraftKey(userId));
  } catch {
    // No crítico.
  }
}

/**
 * Al cerrar sesión: borra los borradores y quién levanta de TODOS los
 * usuarios de este navegador (en un equipo compartido el siguiente no ve el
 * pedido a medias del anterior).
 */
export function clearOrderComposerMemory(storage?: StorageLike) {
  const store = storageOrNull(storage);
  if (!store) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key && (key.startsWith(ORDER_DRAFT_PREFIX) || key.startsWith(BRANCH_EMPLOYEE_PREFIX))) keys.push(key);
    }
    keys.forEach((key) => store.removeItem(key));
  } catch {
    // No crítico.
  }
}

export function readRememberedBranchEmployee(
  userId: string | number | undefined,
  now = Date.now(),
  storage?: StorageLike
): number | undefined {
  const store = storageOrNull(storage);
  if (!store || userId === undefined || userId === "") return undefined;
  try {
    const raw = store.getItem(`${BRANCH_EMPLOYEE_PREFIX}${userId}`);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { id?: unknown; until?: unknown };
    if (typeof parsed.id !== "number" || typeof parsed.until !== "number" || now > parsed.until) return undefined;
    return parsed.id;
  } catch {
    return undefined;
  }
}

/** Recuerda quién levanta hasta el fin del día local (el turno siguiente vuelve a elegir). */
export function rememberBranchEmployee(
  userId: string | number | undefined,
  employeeId: number,
  now = new Date(),
  storage?: StorageLike
) {
  const store = storageOrNull(storage);
  if (!store || userId === undefined || userId === "") return;
  try {
    store.setItem(
      `${BRANCH_EMPLOYEE_PREFIX}${userId}`,
      JSON.stringify({ id: employeeId, until: endOfDay(now).getTime() })
    );
  } catch {
    // No crítico.
  }
}

export function readCreateAnother(userId: string | number | undefined, storage?: StorageLike): boolean {
  const store = storageOrNull(storage);
  if (!store || userId === undefined || userId === "") return false;
  try {
    return store.getItem(`${CREATE_ANOTHER_PREFIX}${userId}`) === "1";
  } catch {
    return false;
  }
}

export function writeCreateAnother(userId: string | number | undefined, value: boolean, storage?: StorageLike) {
  const store = storageOrNull(storage);
  if (!store || userId === undefined || userId === "") return;
  try {
    store.setItem(`${CREATE_ANOTHER_PREFIX}${userId}`, value ? "1" : "0");
  } catch {
    // No crítico.
  }
}
