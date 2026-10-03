"use client";

import { History } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { TableSkeleton, ErrorState } from "@/components/feedback/states";
import { EmptyState } from "@/components/ui/empty-state";
import { useInventoryMovements } from "@/hooks/useInventory";
import { formatQuantity, inventoryAreaLabel } from "@/lib/inventory";
import type { InventoryItem } from "@/types";
import { InventoryMovementsList } from "./InventoryMovementsList";

interface InventoryHistorySheetProps {
  item: InventoryItem | null;
  onClose: () => void;
}

/** Kardex completo de un artículo (hasta los últimos 500 movimientos). */
export function InventoryHistorySheet({ item, onClose }: InventoryHistorySheetProps) {
  const { data = [], isPending, isError, refetch } = useInventoryMovements(
    { itemId: item?.id },
    { enabled: Boolean(item) }
  );

  return (
    <Sheet open={Boolean(item)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Movimientos</SheetTitle>
          {item && (
            <SheetDescription>
              {item.name} · {inventoryAreaLabel(item.area)} · hay {formatQuantity(item.quantity, item.unit)}
            </SheetDescription>
          )}
        </SheetHeader>
        <div className="mt-4">
          {isPending ? (
            <TableSkeleton rows={5} />
          ) : isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : data.length === 0 ? (
            <EmptyState
              icon={History}
              title="Sin movimientos todavía"
              description="Las entradas, salidas y ajustes de este artículo aparecen acá."
            />
          ) : (
            <InventoryMovementsList movements={data} unit={item?.unit} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
