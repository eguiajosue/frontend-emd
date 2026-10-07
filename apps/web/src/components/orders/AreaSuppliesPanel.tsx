"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAreaSupplies, useDiscountPendingSupplies } from "@/hooks/useAreaSupplies";
import { usePermissions } from "@/hooks/usePermissions";
import { getAreaLabel } from "@/lib/areas";
import { formatSupplyQuantity } from "@/lib/areaSupply";
import { formatDateTime } from "@/lib/format";
import type { AreaSupplySheet } from "@/types";

type SheetLine = NonNullable<AreaSupplySheet["areas"][number]["supply"]>["lines"][number];

/** "Pendiente de descontar — faltan 3 cono" (o, si ya hay existencia, que sólo falta reintentar). */
function pendingLabel(line: SheetLine): string {
  const shortfall = Number(line.shortfall ?? 0);
  if (shortfall > 0) {
    const unit = line.inventoryItem?.unit;
    return `Pendiente de descontar — faltan ${formatSupplyQuantity(shortfall)}${unit ? ` ${unit}` : ""}`;
  }
  return "Pendiente de descontar — ya hay existencia";
}

/**
 * Hoja de materiales por área en el detalle del pedido y en "Hoja de
 * materiales": origen del insumo, cada línea con su estado (apartada o
 * descontada del inventario) y los movimientos de inventario que generó.
 */
export function AreaSuppliesPanel({ orderId }: { orderId: number }) {
  const { data, isLoading } = useAreaSupplies(orderId);
  // Sólo Recepción/admin reintentan el descuento (el backend lo exige).
  const { canManageOperations } = usePermissions();
  const discountPending = useDiscountPendingSupplies(orderId);

  if (isLoading) return <Skeleton className="h-16 w-full rounded-xl" />;
  const areas = (data?.areas ?? []).filter((a) => a.supply);
  if (areas.length === 0) return null;

  return (
    <section aria-label="Origen de insumos por área" className="space-y-3">
      <h3 className="text-sm font-semibold">Origen de insumos</h3>
      <ul className="space-y-2">
        {areas.map(({ taskId, area, supply, pendingDiscount }) => (
          <li key={taskId} className="space-y-1.5 rounded-xl bg-muted/50 p-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              {getAreaLabel(area)}
              <Badge variant="muted">{supply!.source === "cliente" ? "Lo trae el cliente" : "Lo ponemos nosotros"}</Badge>
              {canManageOperations && (pendingDiscount || supply!.lines.some((l) => l.pendingDiscount)) && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="ml-auto h-7 gap-1.5 text-xs"
                  disabled={discountPending.isPending}
                  onClick={() => discountPending.mutate(area)}
                  aria-label={`Descontar pendientes de ${getAreaLabel(area)}`}
                >
                  {discountPending.isPending && discountPending.variables === area && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  )}
                  Descontar pendientes
                </Button>
              )}
            </p>
            {supply!.lines.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin detalle.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {supply!.lines.map((line) => (
                  <li key={line.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {line.description} · {formatSupplyQuantity(line.quantity)}
                      {line.inventoryItem?.unit ? ` ${line.inventoryItem.unit}` : ""}
                    </span>
                    {line.inventoryItemId !== null && (
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        {line.pendingDiscount ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 font-medium text-amber-800 dark:text-amber-300"
                            data-testid="supply-pending"
                          >
                            <AlertTriangle className="h-3 w-3" aria-hidden />
                            {pendingLabel(line)}
                          </span>
                        ) : line.state === "descontado" ? (
                          <Badge variant="muted">Descontado</Badge>
                        ) : (
                          <Badge variant="muted">Apartado</Badge>
                        )}
                        {line.stock && (
                          <span>
                            Disponible {formatSupplyQuantity(line.stock.available)} de {formatSupplyQuantity(line.stock.quantity)}
                          </span>
                        )}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      {(data?.movements.length ?? 0) > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Movimientos de inventario</p>
          <ul className="space-y-0.5 text-xs text-muted-foreground">
            {data!.movements.map((m) => (
              <li key={m.id}>
                {m.type === "SALIDA" ? "Salida" : "Entrada"} · {m.item.name} {m.delta > 0 ? "+" : ""}
                {formatSupplyQuantity(m.delta)} {m.item.unit} · {formatDateTime(m.createdAt)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
