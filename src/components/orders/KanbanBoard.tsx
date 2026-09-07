"use client";

import { useState } from "react";
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
  /**
   * Mover un pedido a otra columna arrastrándolo. Si no se pasa, el tablero es
   * de sólo lectura (es el caso de Diseño: su circuito se avanza con las
   * acciones de "Proceso de diseño", no arrastrando).
   */
  onMoveOrder?: (order: Order, statusId: number) => void;
  /** `false` bloquea la columna como destino para ese pedido en particular. */
  canMoveOrder?: (order: Order, statusId: number) => boolean;
}

/**
 * Tablero de pedidos agrupados por estado.
 *
 * Se usa una vez por circuito: quien trabaja en Diseño y además en un área de
 * producción ve dos tableros separados, porque son dos flujos con etapas
 * distintas y mezclarlos en una sola grilla no se entiende. Quien tiene una
 * sola área ve únicamente el suyo, sin título (ver WORKFLOW.md §4 en el
 * backend).
 *
 * Arrastrar una tarjeta a otra columna cambia el estado del pedido. Se usa la
 * API nativa de drag & drop del navegador (sin librería): la tarjeta ya es un
 * bloque con su propio click, así que alcanza con marcarla `draggable` y que
 * la columna acepte el `drop`.
 */
export function KanbanBoard({
  title,
  description,
  columns,
  onOpenOrder,
  onMoveOrder,
  canMoveOrder,
}: KanbanBoardProps) {
  const [draggingOrder, setDraggingOrder] = useState<Order | null>(null);
  const [overStatusId, setOverStatusId] = useState<number | null>(null);

  if (columns.length === 0) return null;

  const draggable = Boolean(onMoveOrder);

  /** `true` si la columna acepta el pedido que se está arrastrando ahora. */
  const acceptsDrop = (statusId: number) => {
    if (!draggingOrder || !onMoveOrder) return false;
    if (statusId < 0) return false; // columna sin id resuelto todavía
    if (canMoveOrder && !canMoveOrder(draggingOrder, statusId)) return false;
    return true;
  };

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
        {columns.map((col) => {
          const isTarget = overStatusId === col.statusId && acceptsDrop(col.statusId);
          return (
            <div
              key={col.statusId}
              className={cn(
                "space-y-3 rounded-2xl border border-transparent p-2 transition-colors",
                isTarget && "border-primary/40 bg-primary/5"
              )}
              onDragOver={(e) => {
                if (!acceptsDrop(col.statusId)) return;
                // Sin `preventDefault` el navegador no considera la columna un
                // destino válido y nunca dispara el `drop`.
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setOverStatusId(col.statusId);
              }}
              onDragLeave={() => {
                setOverStatusId((current) =>
                  current === col.statusId ? null : current
                );
              }}
              onDrop={(e) => {
                e.preventDefault();
                setOverStatusId(null);
                const order = draggingOrder;
                setDraggingOrder(null);
                if (!order || !onMoveOrder) return;
                if (!acceptsDrop(col.statusId)) return;
                onMoveOrder(order, col.statusId);
              }}
            >
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
                  {isTarget ? "Soltar acá" : "Nada por acá todavía"}
                </p>
              ) : (
                <motion.div
                  className="space-y-3"
                  variants={staggerContainerVariants}
                  initial="hidden"
                  animate="show"
                >
                  {col.orders.map((order) => (
                    <div
                      key={order.id}
                      draggable={draggable}
                      onDragStart={(e) => {
                        if (!draggable) return;
                        e.dataTransfer.effectAllowed = "move";
                        // Firefox no arranca el arrastre sin payload.
                        e.dataTransfer.setData("text/plain", String(order.id));
                        setDraggingOrder(order);
                      }}
                      onDragEnd={() => {
                        setDraggingOrder(null);
                        setOverStatusId(null);
                      }}
                      className={cn(
                        draggable && "cursor-grab active:cursor-grabbing",
                        draggingOrder?.id === order.id && "opacity-50"
                      )}
                    >
                      <OrderCard order={order} onOpen={onOpenOrder} />
                    </div>
                  ))}
                </motion.div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
