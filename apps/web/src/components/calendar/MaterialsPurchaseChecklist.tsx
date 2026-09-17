"use client";

import { useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrderMaterials } from "@/hooks/useOrderMaterials";
import { formatCurrencyMXN } from "@/lib/format";
import { getErrorMessage } from "@/lib/api";
import { toast } from "sonner";
import { ShoppingCart } from "lucide-react";

interface MaterialsPurchaseChecklistProps {
  orderId: number;
}

/**
 * Checklist de compra de la hoja de materiales de un pedido: se muestra
 * dentro del evento "Compra de materiales" (categoría "compras") que se
 * crea solo una semana antes de la entrega/instalación. Marcar un material
 * como comprado suma su precio (copiado del precio sugerido del material,
 * ver Material.suggestedPrice) al total; arranca en $0.00.
 */
export function MaterialsPurchaseChecklist({ orderId }: MaterialsPurchaseChecklistProps) {
  const { items, isLoading, isError, update } = useOrderMaterials(orderId);

  const total = useMemo(
    () => items.filter((item) => item.purchased).reduce((sum, item) => sum + (item.price ?? 0), 0),
    [items]
  );

  const handleToggle = async (itemId: number, purchased: boolean) => {
    try {
      await update.mutateAsync({ itemId, payload: { purchased } });
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo actualizar el material."));
    }
  };

  if (isError) return null;

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center gap-1.5 text-sm font-medium">
        <ShoppingCart className="h-4 w-4 text-muted-foreground" />
        Materiales a comprar
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Este pedido todavía no tiene materiales cargados en su hoja.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2.5 rounded-md bg-background/60 p-2 text-sm">
              <Checkbox
                id={`compra-material-${item.id}`}
                checked={Boolean(item.purchased)}
                disabled={update.isPending}
                onCheckedChange={(checked) => handleToggle(item.id, checked === true)}
              />
              <label
                htmlFor={`compra-material-${item.id}`}
                className="min-w-0 flex-1 cursor-pointer truncate"
              >
                <span className="font-medium">{item.quantity}×</span> {item.description}
              </label>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatCurrencyMXN(item.price)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between border-t pt-2 text-sm font-semibold">
        <span>Total comprado</span>
        <span>{formatCurrencyMXN(total)}</span>
      </div>
    </div>
  );
}
