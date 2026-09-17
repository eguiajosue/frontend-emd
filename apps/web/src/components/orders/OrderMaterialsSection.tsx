"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Boxes, Download, Pencil, Plus, Trash2, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/crud/ConfirmDeleteDialog";
import { OrderMaterialDialog } from "@/components/orders/OrderMaterialDialog";
import { useOrderMaterials } from "@/hooks/useOrderMaterials";
import { usePermissions } from "@/hooks/usePermissions";
import { useMotionPreset } from "@/lib/motion";
import { getErrorMessage } from "@/lib/api";
import { LOCATION_BADGE_CLASSES, LOCATION_LABELS } from "@/lib/suppliers";
import { downloadMaterialsSheetPdf } from "@/lib/materialsSheetPdf";
import { cn } from "@/lib/utils";
import type { Order, OrderMaterialItem } from "@/types";

interface OrderMaterialsSectionProps {
  order: Order;
}

/**
 * Hoja de materiales de un pedido: qué se usa, cuánto y de qué proveedor.
 * La carga Recepción (o admin/superuser) cuando el pedido pasa a producción,
 * para que el área sepa qué va a usar — es informativa, NO bloquea el flujo
 * de diseño ni la autorización del montaje.
 */
export function OrderMaterialsSection({ order }: OrderMaterialsSectionProps) {
  const orderId = order.id;
  const { canManageOperations } = usePermissions();
  const { staggerItemVariants } = useMotionPreset();
  const { items, isLoading, isError, remove } = useOrderMaterials(orderId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<OrderMaterialItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<OrderMaterialItem | null>(null);

  const canEdit = canManageOperations;

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
      toast.error(getErrorMessage(error));
    }
  };

  const handleDownloadPdf = () => {
    void downloadMaterialsSheetPdf(order, items);
  };

  // Igual que AreaTasksSection: si el backend todavía no expone el endpoint,
  // no se muestra nada en vez de un error.
  if (isError) return null;

  return (
    <section className="space-y-3 rounded-2xl border bg-muted/20 p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-heading text-sm font-semibold">Hoja de materiales</h3>
          <p className="text-xs text-muted-foreground">
            {items.length === 0
              ? "Opcional: qué se va a usar para este pedido, para que producción lo sepa."
              : "Lo que se va a usar para este pedido."}
          </p>
        </div>
        {items.length > 0 && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5 rounded-full"
            onClick={handleDownloadPdf}
          >
            <Download className="h-4 w-4" />
            Descargar PDF
          </Button>
        )}
      </header>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando hoja de materiales...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no se cargó ningún material.</p>
      ) : (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {items.map((item) => (
              <motion.li
                key={item.id}
                variants={staggerItemVariants}
                initial="hidden"
                animate="show"
                exit={{ opacity: 0, height: 0 }}
                layout
                className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3 shadow-soft"
              >
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <Boxes className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="truncate text-sm">
                    <span className="font-semibold">{item.quantity}×</span> {item.description}
                  </span>
                </span>

                {item.supplier && (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Truck className="h-3.5 w-3.5 shrink-0" />
                    <span className="max-w-[10rem] truncate">{item.supplier.name}</span>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        LOCATION_BADGE_CLASSES[item.supplier.location]
                      )}
                    >
                      {LOCATION_LABELS[item.supplier.location]}
                    </span>
                  </span>
                )}

                {canEdit && (
                  <span className="ml-auto flex items-center gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-full text-muted-foreground"
                      title="Editar"
                      onClick={() => handleEdit(item)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive"
                      title="Quitar"
                      onClick={() => setDeletingItem(item)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </span>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      {canEdit && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5 rounded-full"
          onClick={handleAdd}
        >
          <Plus className="h-4 w-4" />
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
    </section>
  );
}
