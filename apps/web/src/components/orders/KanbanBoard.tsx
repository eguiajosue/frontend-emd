"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { OrderCard } from "@/components/orders/OrderCard";
import { StatusBadge, getStatusIcon } from "@/components/StatusBadge";
import { staggerContainerVariants } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
          "rounded-2xl border border-dashed border-border px-3 py-8 text-center text-xs text-muted-foreground transition-colors",
          isTarget && "border-primary/50 text-primary"
        )}
      >
        {isTarget ? "Soltar aquí" : "Sin pedidos"}
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
      {/* Móvil: una columna a la vez, elegida con pastillas de scroll
          horizontal — mismo control segmentado que el selector de circuito
          de "Pedidos" (activa en gris suave), en vez de un
          `<Select>` que exige abrir un menú para ver las otras columnas. */}
      <div className="md:hidden">
        <ToggleGroup
          type="single"
          variant="segmented"
          size="sm"
          value={String(activeMobileColumn.statusId)}
          onValueChange={(v) => v && setMobileStatusId(Number(v))}
          aria-label="Columna"
          className="-mx-1 mb-3 justify-start overflow-x-auto rounded-full border bg-card p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {columns.map((col) => {
            const Icon = getStatusIcon(col.statusId, col.label);
            return (
              <ToggleGroupItem
                key={col.statusId}
                value={String(col.statusId)}
                className="shrink-0 gap-1.5 whitespace-nowrap"
              >
                <Icon aria-hidden />
                <span className="inline-block first-letter:uppercase">{col.label}</span>
                <span className="text-xs tabular-nums opacity-70">{col.orders.length}</span>
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
        {renderCards(activeMobileColumn, false)}
      </div>

      {/* Escritorio/tablet: todas las columnas en una sola fila con scroll
          horizontal, para leer el flujo completo de izquierda a derecha. */}
      <div className="-mx-1 hidden overflow-x-auto px-1 pb-3 [scrollbar-color:hsl(var(--border))_transparent] [scrollbar-width:thin] md:block">
      <div className="flex min-w-max items-start gap-3">
        {columns.map((col) => {
          const isTarget = overStatusId === col.statusId && acceptsDrop(col.statusId);
          return (
            <section
              key={col.statusId}
              aria-label={col.label}
              className={cn(
                "w-[18.5rem] shrink-0 rounded-2xl p-1.5 transition-colors duration-150",
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
              {/* Cabecera = tarjeta baja con la píldora del estado (ícono +
                  nombre + contador). Fija al hacer scroll largo de la columna. */}
              <header
                className={cn(
                  "sticky top-0 z-10 mb-3 flex items-center gap-2 rounded-2xl border border-border/60 bg-card px-3 py-2.5 shadow-soft transition-colors",
                  isTarget && "border-primary/50"
                )}
              >
                <h3 className="min-w-0">
                  <StatusBadge
                    statusId={col.statusId}
                    statusName={col.label}
                    count={col.orders.length}
                    className="py-1 text-[0.8125rem]"
                  />
                </h3>
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
