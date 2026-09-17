"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDeleteDialog } from "@/components/crud/ConfirmDeleteDialog";
import { OrderMaterialDialog } from "@/components/orders/OrderMaterialDialog";
import { useOrderMaterials } from "@/hooks/useOrderMaterials";
import { usePermissions } from "@/hooks/usePermissions";
import { formatCurrencyMXN } from "@/lib/format";
import { getErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { OrderMaterialItem } from "@/types";

interface OrderMaterialsChecklistTableProps {
  orderId: number;
}

/**
 * Hoja de materiales de UN pedido, en forma de tabla checklist (igual al
 * Excel que se usaba antes): cantidad, material, proveedor, precio y una
 * casilla para tachar lo ya comprado. El total suma el precio de las líneas
 * marcadas — arranca en $0.00.
 *
 * Vive en /dashboard/hoja-materiales (lista de pedidos, cada uno se
 * despliega en esta tabla) — ya no dentro del detalle del pedido.
 */
export function OrderMaterialsChecklistTable({ orderId }: OrderMaterialsChecklistTableProps) {
  const { canManageOperations } = usePermissions();
  const { items, isLoading, isError, update, remove } = useOrderMaterials(orderId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<OrderMaterialItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<OrderMaterialItem | null>(null);

  const total = useMemo(
    () => items.filter((item) => item.purchased).reduce((sum, item) => sum + (item.price ?? 0), 0),
    [items]
  );

  const handleToggle = async (item: OrderMaterialItem, purchased: boolean) => {
    try {
      await update.mutateAsync({ itemId: item.id, payload: { purchased } });
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo actualizar el material."));
    }
  };

  const handleAdd = () => {
    setEditingItem(null);
    setDialogOpen(true);
  };

  const handleEdit = (item: OrderMaterialItem) => {
    setEditingItem(item);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingItem) return;
    try {
      await remove.mutateAsync(deletingItem.id);
      toast.success("Material quitado de la hoja");
      setDeletingItem(null);
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo quitar el material."));
    }
  };

  if (isError) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        La hoja de materiales todavía no está disponible.
      </p>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no se cargó ningún material.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="w-10 px-2 py-2 text-left">Comprado</th>
                <th className="w-16 px-2 py-2 text-right">Cant.</th>
                <th className="px-2 py-2 text-left">Material</th>
                <th className="px-2 py-2 text-left">Proveedor</th>
                <th className="px-2 py-2 text-right">Precio</th>
                {canManageOperations && <th className="w-20 px-2 py-2 text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className={cn("border-t", item.purchased && "bg-muted/20")}
                >
                  <td className="px-2 py-2">
                    <Checkbox
                      aria-label={`Marcar ${item.description} como comprado`}
                      checked={Boolean(item.purchased)}
                      disabled={update.isPending || !canManageOperations}
                      onCheckedChange={(checked) => handleToggle(item, checked === true)}
                    />
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{item.quantity}</td>
                  <td
                    className={cn(
                      "px-2 py-2",
                      item.purchased && "text-muted-foreground line-through"
                    )}
                  >
                    {item.description}
                    {item.material?.unit && (
                      <span className="text-muted-foreground"> ({item.material.unit.name})</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-muted-foreground">
                    {item.supplier?.name ?? "—"}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {formatCurrencyMXN(item.price)}
                  </td>
                  {canManageOperations && (
                    <td className="px-2 py-2">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground"
                          title="Editar"
                          onClick={() => handleEdit(item)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          title="Quitar"
                          onClick={() => setDeletingItem(item)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/30 font-semibold">
                <td colSpan={4} className="px-2 py-2 text-right">
                  Total comprado
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{formatCurrencyMXN(total)}</td>
                {canManageOperations && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {canManageOperations && (
        <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={handleAdd}>
          {update.isPending || remove.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Agregar material
        </Button>
      )}

      <OrderMaterialDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        orderId={orderId}
        item={editingItem}
      />

      <ConfirmDeleteDialog
        open={Boolean(deletingItem)}
        onOpenChange={(open) => !open && setDeletingItem(null)}
        onConfirm={handleDelete}
        title="¿Quitar material de la hoja?"
        description="Esta acción quitará el material de la hoja de este pedido."
      />
    </div>
  );
}
