"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TAB_PRIORITY_URLS, MAX_PRIMARY_TABS, findActiveNavUrl } from "@/lib/navMenu";
import { useVisibleNavItems, type VisibleNavItem } from "@/hooks/useVisibleNavItems";
import { MobileMoreSheet } from "./MobileMoreSheet";

/**
 * Barra de tabs flotante para móvil (referencia B). No es un segundo menú:
 * es un atajo a los 4 destinos más usados del rol actual, más un tab "Más"
 * que abre `MobileMoreSheet`, un bottom sheet propio (no el `Sidebar`
 * primitive, inerte en móvil) con el resto del menú, config, tema, reporte
 * de error y logout.
 */
/** Etiqueta de una palabra bajo el ícono: los títulos completos no entran. */
const SHORT_LABELS: Record<string, string> = {
  "/dashboard/admin": "Panel",
  "/dashboard/chat": "Chat",
  "/dashboard/notificaciones": "Avisos",
  "/dashboard/admin/rendimiento": "Métricas",
  "/dashboard/hoja-materiales": "Compras",
  "/dashboard/historial": "Historial",
  "/dashboard/clientes": "Clientes",
  "/dashboard/materiales": "Materiales",
  "/dashboard/calendario": "Agenda",
  "/dashboard/usuarios": "Usuarios",
  "/dashboard/ayuda": "Ayuda",
};

function shortLabel(item: VisibleNavItem): string {
  if (item.url === "/dashboard/orders") return item.title === "Pedidos" ? "Pedidos" : "Tareas";
  return SHORT_LABELS[item.url] ?? item.title;
}

export function MobileTabBar() {
  const pathname = usePathname();
  const visibleItems = useVisibleNavItems();
  const [moreOpen, setMoreOpen] = useState(false);

  const primaryTabs = TAB_PRIORITY_URLS.map((url) =>
    visibleItems.find((item) => item.url === url)
  )
    .filter((item): item is VisibleNavItem => Boolean(item))
    .slice(0, MAX_PRIMARY_TABS);
  // Activo por prefijo: el detalle de un pedido sigue marcando "Pedidos".
  const activeUrl = findActiveNavUrl(
    visibleItems.map((item) => item.url),
    pathname
  );

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:hidden"
    >
      <div className="inline-flex items-center gap-1 rounded-full bg-card p-1.5 shadow-soft-md">
        {primaryTabs.map((item) => {
          const active = activeUrl === item.url;
          return (
            <Link
              key={item.url}
              href={item.url}
              aria-current={active ? "page" : undefined}
              aria-label={item.title}
              className="relative flex h-14 w-16 flex-col items-center justify-center gap-0.5 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              {active && (
                <motion.span
                  layoutId="mobile-tabbar-highlight"
                  aria-hidden
                  className="pointer-events-none absolute inset-0 -z-10 rounded-2xl bg-primary/10"
                  transition={{ type: "spring", stiffness: 400, damping: 35 }}
                />
              )}
              <span className="relative">
                <item.icon
                  className={cn("h-5 w-5", active ? "text-primary" : "text-muted-foreground")}
                />
                {item.unreadCount > 0 && (
                  <span className="pointer-events-none absolute -right-1.5 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground ring-2 ring-card">
                    {item.unreadCount > 99 ? "99+" : item.unreadCount}
                  </span>
                )}
              </span>
              <span
                aria-hidden
                className={cn(
                  "text-[11px] font-medium leading-none",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                {shortLabel(item)}
              </span>
            </Link>
          );
        })}
        <Button
          variant="ghost"
          onClick={() => setMoreOpen(true)}
          aria-label="Más opciones"
          className="relative h-14 w-16 flex-col gap-0.5 rounded-2xl px-0 text-muted-foreground hover:bg-transparent [&_svg]:size-5"
        >
          <Menu />
          <span aria-hidden className="text-[11px] font-medium leading-none">
            Más
          </span>
        </Button>
      </div>
      <MobileMoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </nav>
  );
}
