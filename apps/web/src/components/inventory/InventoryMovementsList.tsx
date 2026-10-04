"use client";

import { formatOrderCode } from "@/lib/orderCode";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import { formatDateTime } from "@/lib/format";
import {
  MOVEMENT_TYPE_META,
  formatDelta,
  formatQuantity,
  inventoryAreaLabel,
} from "@/lib/inventory";
import { cn } from "@/lib/utils";
import type { InventoryMovement } from "@/types";

const SHORT_DATE: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

interface InventoryMovementsListProps {
  movements: InventoryMovement[];
  /** Muestra artículo y departamento en cada fila (vista general, no la de un artículo). */
  showItem?: boolean;
  /** Unidad a mostrar cuando el movimiento no trae su artículo (kardex de un artículo). */
  unit?: string;
}

/**
 * Kardex legible: tipo, cambio con signo, saldo resultante, quién y cuándo,
 * más la nota y el pedido al que se imputó (si hay).
 */
export function InventoryMovementsList({ movements, showItem = false, unit }: InventoryMovementsListProps) {
  const { timeFormat } = useTimeFormat();

  return (
    <ul className="divide-y divide-border/60">
      {movements.map((m) => {
        const meta = MOVEMENT_TYPE_META[m.type];
        const itemUnit = m.item?.unit ?? unit;
        const who = m.createdBy
          ? [m.createdBy.firstName, m.createdBy.lastName].filter(Boolean).join(" ")
          : null;
        return (
          <li key={m.id} className="flex items-start gap-3 py-3">
            <Badge className={cn("mt-0.5 w-[4.75rem] shrink-0 justify-center", meta.className)}>{meta.label}</Badge>
            <div className="min-w-0 flex-1 space-y-0.5">
              {showItem && m.item && (
                <p className="truncate text-sm font-medium">
                  {m.item.name}
                  <span className="font-normal text-muted-foreground"> · {inventoryAreaLabel(m.item.area)}</span>
                </p>
              )}
              <p className="text-meta">
                {formatDateTime(m.createdAt, SHORT_DATE, timeFormat)}
                {who && ` · ${who}`}
                {m.unitCost != null && ` · $${m.unitCost.toFixed(2)} c/u`}
              </p>
              {(m.note || m.order) && (
                <p className="text-sm text-muted-foreground">
                  {m.note}
                  {m.note && m.order && " · "}
                  {m.order && (
                    <Link href={`/dashboard/orders/${m.order.id}`} className="underline-offset-2 hover:underline">
                      Pedido {formatOrderCode(m.order.id)}
                    </Link>
                  )}
                </p>
              )}
            </div>
            <div className="shrink-0 text-right">
              <p
                className={cn(
                  "text-sm font-semibold",
                  m.delta > 0 && "text-emerald-700 dark:text-emerald-300",
                  m.delta < 0 && "text-orange-700 dark:text-orange-300"
                )}
              >
                {formatDelta(m.delta)}
              </p>
              <p className="text-meta">Saldo {formatQuantity(m.balanceAfter, itemUnit)}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
