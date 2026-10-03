"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
        <div className="overflow-x-auto rounded-2xl border border-border/60">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-10 text-left">Comprado</TableHead>
                <TableHead className="w-16 text-right">Cant.</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                {canManageOperations && <TableHead className="w-20 text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow
                  key={item.id}
                  className={cn(item.purchased && "bg-muted/20")}
                >
                  <TableCell>
                    <Checkbox
                      aria-label={`Marcar ${item.description} como comprado`}
                      checked={Boolean(item.purchased)}
                      disabled={update.isPending || !canManageOperations}
                      onCheckedChange={(checked) => handleToggle(item, checked === true)}
                    />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                  <TableCell
                    className={cn(
                      "",
                      item.purchased && "text-muted-foreground line-through"
                    )}
                  >
                    {item.description}
                    {item.material?.unit && (
                      <span className="text-muted-foreground"> ({item.material.unit.name})</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.supplier?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrencyMXN(item.price)}
                  </TableCell>
                  {canManageOperations && (
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 rounded-full text-muted-foreground"
                          aria-label={`Editar ${item.description}`}
                          onClick={() => handleEdit(item)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          aria-label={`Quitar ${item.description}`}
                          onClick={() => setDeletingItem(item)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="font-semibold">
                <TableCell colSpan={4} className="text-right">
                  Total comprado
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrencyMXN(total)}</TableCell>
                {canManageOperations && <TableCell />}
              </TableRow>
            </TableFooter>
          </Table>
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
