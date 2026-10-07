import { MAX_QUANTITY } from "@/lib/inventory";
/**
 * Piezas puras del modo Escanear: qué movimiento deshace a cuál, cómo se
 * clasifica la respuesta del backend y cómo se lee la cantidad.
 */

export type ScanMovementType = "ENTRADA" | "SALIDA";

export function oppositeMovement(type: ScanMovementType): ScanMovementType {
  return type === "ENTRADA" ? "SALIDA" : "ENTRADA";
}

/** Cambio con signo que un escaneo aplica al stock. */
export function scanDelta(type: ScanMovementType, quantity: number): number {
  return type === "ENTRADA" ? quantity : -quantity;
}

export type ScanErrorKind =
  /** 404: ningún artículo (visible) tiene ese código → ofrecer ligar/crear. */
  | "unknown"
  /** 400 "Stock insuficiente: hay N …" en una salida. */
  | "stock"
  /** 400 de formato del código. */
  | "invalid"
  | "other";

export function classifyScanError(error: unknown): ScanErrorKind {
  if (!error || typeof error !== "object") return "other";
  const { status, message } = error as { status?: number; message?: string };
  if (status === 404) return "unknown";
  if (status === 400 && typeof message === "string") {
    if (/^Stock insuficiente/i.test(message)) return "stock";
    if (/código de barras/i.test(message)) return "invalid";
  }
  return "other";
}

/**
 * Cantidad por escaneo escrita en el campo: número positivo (admite
 * decimales: litros, metros). `null` si no sirve.
 */
export function parseScanQuantity(raw: string): number | null {
  const n = Number(raw.replace(",", ".").trim());
  if (!raw.trim() || !Number.isFinite(n) || n <= 0 || n > MAX_QUANTITY) return null;
  return n;
}

export interface ScanLogEntry {
  id: number;
  code: string;
  itemId: number;
  itemName: string;
  unit: string;
  type: ScanMovementType;
  quantity: number;
  /** Existencia después del escaneo. */
  balanceAfter: number;
  at: Date;
  /** Ya se deshizo (con el movimiento contrario). */
  undone: boolean;
}

/** El registro de la sesión guarda los más recientes primero, hasta `max`. */
export function pushLogEntry(log: ScanLogEntry[], entry: ScanLogEntry, max = 50): ScanLogEntry[] {
  return [entry, ...log].slice(0, max);
}
