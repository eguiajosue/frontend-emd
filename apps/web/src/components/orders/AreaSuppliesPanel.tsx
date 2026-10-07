"use client";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAreaSupplies } from "@/hooks/useAreaSupplies";
import { getAreaLabel } from "@/lib/areas";
import { formatSupplyQuantity } from "@/lib/areaSupply";
import { formatDateTime } from "@/lib/format";

/**
 * Hoja de materiales por área en el detalle del pedido y en "Hoja de
 * materiales": origen del insumo, cada línea con su estado (apartada o
 * descontada del inventario) y los movimientos de inventario que generó.
 */
export function AreaSuppliesPanel({ orderId }: { orderId: number }) {
  const { data, isLoading } = useAreaSupplies(orderId);

  if (isLoading) return <Skeleton className="h-16 w-full rounded-xl" />;
  const areas = (data?.areas ?? []).filter((a) => a.supply);
  if (areas.length === 0) return null;

  return (
    <section aria-label="Origen de insumos por área" className="space-y-3">
      <h3 className="text-sm font-semibold">Origen de insumos</h3>
      <ul className="space-y-2">
        {areas.map(({ taskId, area, supply }) => (
          <li key={taskId} className="space-y-1.5 rounded-xl bg-muted/50 p-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              {getAreaLabel(area)}
              <Badge variant="muted">{supply!.source === "cliente" ? "Lo trae el cliente" : "Lo ponemos nosotros"}</Badge>
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
                        {line.state === "descontado" ? (
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
