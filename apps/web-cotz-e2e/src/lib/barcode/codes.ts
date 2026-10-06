/**
 * Reglas de los códigos de barras del inventario. Espejo de
 * `backend-emd/src/inventory/inventory.constants.ts` + `normalizeBarcode`:
 * validar aquí sólo adelanta el mensaje; el backend decide.
 *
 * - Code 128 admite ASCII imprimible: 3 a 64 caracteres, recortados.
 * - `EMD-<número>` lo asigna el sistema (uno por artículo: `EMD-000123`).
 *   Escribirlo a mano sólo vale si es justo el del propio artículo.
 * - Vacío = "usar el automático".
 */

export const BARCODE_MIN_LENGTH = 3;
export const BARCODE_MAX_LENGTH = 64;
export const BARCODE_PATTERN = /^[\x20-\x7E]+$/;
export const RESERVED_BARCODE_PATTERN = /^EMD-\d+$/;

/** Código por omisión de un artículo: `EMD-` + id con ceros (EMD-000123). */
export function defaultBarcode(id: number): string {
  return `EMD-${String(id).padStart(6, "0")}`;
}

/** El código de un artículo es el automático (no uno propio ligado). */
export function isDefaultBarcode(code: string | null | undefined, id: number): boolean {
  return !code || code === defaultBarcode(id);
}

/** Código con el que se imprime y se escanea un artículo. */
export function itemBarcode(item: { id: number; barcode?: string | null }): string {
  return item.barcode || defaultBarcode(item.id);
}

export type BarcodeValidation = { ok: true; code: string } | { ok: false; error: string };

/**
 * Valida un código propio escrito (o escaneado) en el formulario del
 * artículo. `ownId` = el artículo que se edita: su `EMD-` sí se acepta.
 */
export function validateCustomBarcode(raw: string, ownId?: number): BarcodeValidation {
  const code = raw.trim();
  if (code.length < BARCODE_MIN_LENGTH || code.length > BARCODE_MAX_LENGTH) {
    return {
      ok: false,
      error: `El código de barras debe tener entre ${BARCODE_MIN_LENGTH} y ${BARCODE_MAX_LENGTH} caracteres`,
    };
  }
  if (!BARCODE_PATTERN.test(code)) {
    return {
      ok: false,
      error: "Sólo letras sin acentos, números, espacios y símbolos ASCII",
    };
  }
  if (RESERVED_BARCODE_PATTERN.test(code) && (ownId === undefined || code !== defaultBarcode(ownId))) {
    return {
      ok: false,
      error: "Los códigos EMD-<número> los asigna el sistema; usa el automático",
    };
  }
  return { ok: true, code };
}

/**
 * Limpia lo que entrega un lector o la cámara: sin espacios a los lados ni
 * caracteres de control (algunos lectores mandan prefijos/sufijos raros).
 * `null` si no puede ser un código del inventario.
 */
export function normalizeScannedCode(raw: string): string | null {
  // eslint-disable-next-line no-control-regex
  const code = raw.replace(/[\x00-\x1F\x7F]/g, "").trim();
  if (code.length < BARCODE_MIN_LENGTH || code.length > BARCODE_MAX_LENGTH) return null;
  if (!BARCODE_PATTERN.test(code)) return null;
  return code;
}

/**
 * Payload de `barcode` para el PATCH del artículo a partir de lo que quedó en
 * el campo: `undefined` = no cambió (no se manda), `null` = volver al
 * automático, texto = código propio.
 */
export function barcodePatchValue(
  input: string,
  item: { id: number; barcode?: string | null } | null | undefined
): string | null | undefined {
  const code = input.trim();
  if (!item) return code === "" ? undefined : code;
  const current = item.barcode ?? defaultBarcode(item.id);
  if (code === current) return undefined;
  if (code === "" || code === defaultBarcode(item.id)) return null;
  return code;
}

/**
 * El error del backend al guardar un artículo es del campo "Código de
 * barras" (409 "Ese código ya está asignado a …", 400 de formato o de
 * `EMD-` reservado) y no del formulario en general.
 */
export function isBarcodeError(error: unknown): error is { status: number; message: string } {
  if (!error || typeof error !== "object") return false;
  const { status, message } = error as { status?: unknown; message?: unknown };
  if (typeof message !== "string") return false;
  if (status === 409) return /^Ese código ya está asignado/.test(message);
  if (status === 400) return /código de barras|EMD-<número>/i.test(message);
  return false;
}
