"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem } from "@/components/ui/sidebar";
import { TONE_META } from "@/components/orders/OrderJobCard";
import { useOrders } from "@/hooks/useOrders";
import { useNow } from "@/hooks/useNow";
import {
  ORDER_TONE_PARAM,
  SAVED_ORDER_VIEWS,
  countOrdersByTone,
  orderViewHref,
  parseToneParam,
} from "@/lib/orderViews";
import { cn } from "@/lib/utils";

/**
 * Conteo en vivo por plazo. Misma query que la pantalla de Pedidos (sin
 * fetch extra cuando ya está en caché) y el mismo reloj por minuto que las
 * tarjetas, así el número del menú nunca contradice al muro.
 */
export function useOrderViewCounts(enabled = true) {
  const { data: orders } = useOrders({ enabled });
  const now = useNow();
  return useMemo(() => countOrdersByTone(orders, now), [orders, now]);
}

/**
 * Accesos guardados bajo "Pedidos": un click a "Vencidos", "Vencen en 48 h"
 * o "Por entregar", con su conteo. Usa `useSearchParams` (marca el activo),
 * así que se monta dentro de `<Suspense>`.
 */
export function SidebarOrderViews() {
  const pathname = usePathname();
  const params = useSearchParams();
  const counts = useOrderViewCounts();
  const activeTone = pathname === "/dashboard/orders" ? parseToneParam(params.get(ORDER_TONE_PARAM)) : null;

  return (
    <SidebarMenuSub aria-label="Vistas de pedidos" className="mt-0.5">
      {SAVED_ORDER_VIEWS.map(({ tone, label }) => {
        const active = activeTone === tone;
        const count = counts[tone];
        return (
          <SidebarMenuSubItem key={tone}>
            <SidebarMenuSubButton asChild size="sm" isActive={active}>
              <Link
                href={orderViewHref(tone)}
                aria-current={active ? "page" : undefined}
                className={cn(active && "font-medium text-primary")}
              >
                <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", TONE_META[tone].dot)} />
                <span className="flex-1">{label}</span>
                <span
                  className={cn(
                    "tabular-nums",
                    count === 0
                      ? "text-muted-foreground/60"
                      : tone === "overdue"
                      ? "font-semibold text-rose-600 dark:text-rose-400"
                      : "text-muted-foreground"
                  )}
                >
                  {count}
                </span>
              </Link>
            </SidebarMenuSubButton>
          </SidebarMenuSubItem>
        );
      })}
    </SidebarMenuSub>
  );
}
