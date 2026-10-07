import { describe, expect, it } from "vitest";
import { notificationGroup, notificationHref, notificationTag } from "./notifications";
import { ApiError, getErrorMessage } from "@/lib/api";
import { parseScanQuantity } from "@/lib/barcode/scanSession";
import { draftsComplete } from "./areaSupply";

describe("avisos de inventario por la hoja de materiales", () => {
  it("'inventory_pending_discount' tiene etiqueta propia, grupo Inventario y lleva al pedido", () => {
    expect(notificationTag("inventory_pending_discount").label).toBe("Descuento pendiente");
    expect(notificationGroup("inventory_pending_discount")).toBe("inventario");
    expect(notificationHref({ type: "inventory_pending_discount", orderId: 12 })).toBe("/dashboard/orders/12");
  });

  it("'inventory_low_stock' sigue llevando al inventario cuando no trae pedido", () => {
    expect(notificationTag("inventory_low_stock").label).toBe("Stock bajo");
    expect(notificationHref({ type: "inventory_low_stock" })).toBe("/dashboard/inventario");
  });
});

describe("tope de 999999 por cantidad", () => {
  it("el escáner y la hoja de materiales lo respetan", () => {
    expect(parseScanQuantity("999999")).toBe(999999);
    expect(parseScanQuantity("1000000")).toBeNull();
    const line = (quantity: string) => ({
      cliente: { source: "cliente" as const, lines: [{ key: "a", description: "x", quantity }] },
    });
    expect(draftsComplete(line("999999"), ["cliente"])).toBe(true);
    expect(draftsComplete(line("1000000"), ["cliente"])).toBe(false);
  });
});

describe("errores del backend", () => {
  it("un 409 (ej. borrar una cuenta de sucursal) muestra el mensaje del backend", () => {
    const message = "No se puede eliminar una cuenta de sucursal";
    expect(getErrorMessage(new ApiError(message, 409))).toBe(message);
  });
});
