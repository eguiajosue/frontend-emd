"use client";

import { motion } from "framer-motion";
import { OrderCard } from "@/components/orders/OrderCard";
import { staggerContainerVariants } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { Order } from "@/types";

export interface KanbanColumn {
  statusId: number;
  label: string;
  orders: Order[];
}

interface KanbanBoardProps {
  /** Sólo se pasa cuando conviven varios tableros (ej. Diseño y Producción). */
  title?: string;
  description?: string;
  columns: KanbanColumn[];
  onOpenOrder: (orderId: number) => void;
}

/**
 * Tablero de pedidos agrupados por estado.
 *
 * Se usa una vez por circuito: quien trabaja en Diseño y además en un área de
 * producción ve dos tableros separados, porque son dos flujos con etapas
 * distintas y mezclarlos en una sola grilla no se entiende. Quien tiene una
 * sola área ve únicamente el suyo, sin título (ver WORKFLOW.md §4 en el
 * backend).
 */
export function KanbanBoard({
  title,
  description,
  columns,
  onOpenOrder,
}: KanbanBoardProps) {
  if (columns.length === 0) return null;

  return (
    <section className="space-y-4">
      {title && (
        <header className="space-y-0.5">
          <h2 className="font-heading text-lg font-semibold">{title}</h2>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </header>
      )}

      <div
        className={cn(
          "grid gap-4",
          columns.length <= 1 && "sm:grid-cols-1",
          columns.length === 2 && "sm:grid-cols-2",
          columns.length >= 3 && "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        )}
      >
        {columns.map((col) => (
          <div key={col.statusId} className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {col.label}
              </h3>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {col.orders.length}
              </span>
            </div>
            {col.orders.length === 0 ? (
              <p className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">
                Nada por acá todavía
              </p>
            ) : (
              <motion.div
                className="space-y-3"
                variants={staggerContainerVariants}
                initial="hidden"
                animate="show"
              >
                {col.orders.map((order) => (
                  <OrderCard key={order.id} order={order} onOpen={onOpenOrder} />
                ))}
              </motion.div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
