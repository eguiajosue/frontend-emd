import type { SheetData } from "write-excel-file/browser";

/**
 * Hoja de cálculo del export "Excel" de la pantalla de pedidos.
 *
 * Antes se armaba con `xlsx` (SheetJS 0.18.5 de npm, que ya no recibe parches
 * y arrastra avisos de prototype pollution / ReDoS). Ahora se usa
 * `write-excel-file`, que sólo escribe (no parsea archivos ajenos) y es MIT.
 *
 * Se replica lo que hacía `XLSX.utils.json_to_sheet`: una fila de encabezados
 * con las llaves del primer objeto (en orden de inserción) y una fila por
 * objeto. Números quedan como números; el resto, como texto.
 */
export type OrdersExportRow = Record<string, string | number | null | undefined>;

export const ORDERS_EXPORT_SHEET_NAME = "Pedidos";

export function buildOrdersSheetData(rows: OrdersExportRow[]): SheetData {
  if (rows.length === 0) return [];
  const headers = Object.keys(rows[0]);
  const headerRow = headers.map((header) => ({ value: header, fontWeight: "bold" as const }));
  const bodyRows = rows.map((row) =>
    headers.map((header) => {
      const value = row[header];
      if (value === null || value === undefined) return null;
      return typeof value === "number"
        ? { type: Number, value }
        : { type: String, value: String(value) };
    })
  );
  return [headerRow, ...bodyRows];
}

/** `pedidos-AAAA-MM-DD.xlsx`, igual que el export anterior. */
export function ordersExportFileName(now: Date = new Date()): string {
  return `pedidos-${now.toISOString().slice(0, 10)}.xlsx`;
}
