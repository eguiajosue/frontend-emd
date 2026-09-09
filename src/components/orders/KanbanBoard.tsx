"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { OrderCard } from "@/components/orders/OrderCard";
import { staggerContainerVariants } from "@/lib/motion";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Order } from "@/types";

export interface KanbanColumn {
  statusId: number;
  label: string;
  orders: Order[];
}

interface KanbanBoardProps {
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
 * Las columnas van en UNA sola fila con scroll horizontal, no en una grilla que
 * se parte en varias filas. Con 5 estados y una grilla de 4 columnas, la quinta
 * bajaba a una segunda fila y el tablero dejaba de leerse como un flujo de
 * izquierda a derecha: parecían dos tableros distintos pegados. En una pista
 * horizontal el orden del flujo es siempre el mismo eje, sin importar el ancho
 * de la pantalla.
 *
 * Arrastrar una tarjeta a otra columna cambia el estado del pedido. Se usa la
 * API nativa de drag & drop del navegador (sin librería): la tarjeta ya es un
 * bloque con su propio click, así que alcanza con marcarla `draggable` y que
 * la columna acepte el `drop`.
 */
export function KanbanBoard({
  columns,
  onOpenOrder,
  onMoveOrder,
  canMoveOrder,
}: KanbanBoardProps) {
  const [draggingOrder, setDraggingOrder] = useState<Order | null>(null);
  const [overStatusId, setOverStatusId] = useState<number | null>(null);
  const [mobileStatusId, setMobileStatusId] = useState<number | null>(null);

  if (columns.length === 0) return null;

  const draggable = Boolean(onMoveOrder);

  /** `true` si la columna acepta el pedido que se está arrastrando ahora. */
  const acceptsDrop = (statusId: number) => {
    if (!draggingOrder || !onMoveOrder) return false;
    if (statusId < 0) return false; // columna sin id resuelto todavía
    if (canMoveOrder && !canMoveOrder(draggingOrder, statusId)) return false;
    return true;
  };

  // En pantallas angostas no tiene sentido un tablero de columnas fijas con
  // scroll horizontal: se ve una a la vez, elegida con un selector.
  const activeMobileColumn =
    columns.find((c) => c.statusId === mobileStatusId) ?? columns[0];

  const renderCards = (col: KanbanColumn, isTarget: boolean) =>
    col.orders.length === 0 ? (
      <p
        className={cn(
          "rounded-xl border border-dashed px-3 py-6 text-center text-xs text-muted-foreground/70 transition-colors",
          isTarget && "border-primary/50 text-primary"
        )}
      >
        {isTarget ? "Soltar acá" : "Sin pedidos"}
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
              draggingOrder?.id === order.id && "opacity-40"
            )}
          >
            <OrderCard order={order} onOpen={onOpenOrder} />
          </div>
        ))}
      </motion.div>
    );

  return (
    <>
      {/* Móvil: una columna a la vez, elegida con un selector — nada de scroll
          horizontal por un tablero pensado para escritorio. */}
      <div className="md:hidden">
        <Select
          value={String(activeMobileColumn.statusId)}
          onValueChange={(v) => setMobileStatusId(Number(v))}
        >
          <SelectTrigger className="mb-3">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {columns.map((col) => (
              <SelectItem key={col.statusId} value={String(col.statusId)}>
                {col.label} ({col.orders.length})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {renderCards(activeMobileColumn, false)}
      </div>

      {/* Escritorio/tablet: todas las columnas en una sola fila con scroll
          horizontal, para leer el flujo completo de izquierda a derecha. */}
      <div className="-mx-1 hidden overflow-x-auto px-1 pb-3 [scrollbar-color:hsl(var(--border))_transparent] [scrollbar-width:thin] md:block">
      <div className="flex min-w-max items-start gap-5">
        {columns.map((col) => {
          const isTarget = overStatusId === col.statusId && acceptsDrop(col.statusId);
          return (
            <section
              key={col.statusId}
              aria-label={col.label}
              className={cn(
                "w-[17.5rem] shrink-0 rounded-2xl px-2 pb-2 transition-colors duration-150",
                // La columna no es una tarjeta: las tarjetas van adentro y
                // anidarlas ensucia la jerarquía. Sólo se tiñe mientras es
                // destino de un arrastre.
                isTarget && "bg-primary/[0.06]"
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
              <header
                className={cn(
                  "sticky top-0 z-10 -mx-2 mb-3 flex items-baseline gap-2 border-b bg-background/85 px-2 pb-2 pt-1 backdrop-blur transition-colors",
                  isTarget && "border-primary/40"
                )}
              >
                <h3 className="truncate text-[0.8125rem] font-semibold uppercase tracking-[0.06em] text-foreground/70">
                  {col.label}
                </h3>
                <span className="text-xs font-medium tabular-nums text-muted-foreground">
                  {col.orders.length}
                </span>
              </header>

              {renderCards(col, isTarget)}
            </section>
          );
        })}
      </div>
      </div>
    </>
  );
}
