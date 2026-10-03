"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
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
/** Etiqueta de una palabra junto al ícono activo: los títulos completos no entran. */
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
  if (item.url === "/dashboard/orders") return "Pedidos";
  if (item.url === "/dashboard/tareas") return "Tareas";
  return SHORT_LABELS[item.url] ?? item.title;
}

export function MobileTabBar() {
  const pathname = usePathname();
  const visibleItems = useVisibleNavItems();
  const [moreOpen, setMoreOpen] = useState(false);
  const reducedMotion = useReducedMotion();

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
      {/* Píldora blanca flotante, mismo lenguaje que el riel de escritorio:
          íconos en círculo y el destino activo en tinta, que además se estira
          para mostrar su nombre corto. */}
      <div className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card p-1.5 shadow-soft-md dark:border-border">
        {primaryTabs.map((item) => {
          const active = activeUrl === item.url;
          return (
            <Link
              key={item.url}
              href={item.url}
              aria-current={active ? "page" : undefined}
              aria-label={item.title}
              className={cn(
                "relative flex h-12 items-center justify-center gap-2 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                active
                  ? "px-4 text-sidebar-primary-foreground"
                  : "w-12 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {active && (
                <motion.span
                  layoutId="mobile-tabbar-highlight"
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-full bg-sidebar-primary"
                  transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 35 }}
                />
              )}
              <span className="relative">
                <item.icon className="h-5 w-5" />
                {item.unreadCount > 0 && (
                  <span className="pointer-events-none absolute -right-2 -top-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground ring-2 ring-card">
                    {item.unreadCount > 99 ? "99+" : item.unreadCount}
                  </span>
                )}
              </span>
              {active && (
                <span aria-hidden className="relative text-[0.8125rem] font-medium leading-none">
                  {shortLabel(item)}
                </span>
              )}
            </Link>
          );
        })}
        <Button
          variant="ghost"
          onClick={() => setMoreOpen(true)}
          aria-label="Más opciones"
          aria-expanded={moreOpen}
          className={cn(
            "h-12 w-12 rounded-full p-0 text-muted-foreground hover:bg-muted hover:text-foreground [&_svg]:size-5",
            moreOpen && "bg-muted text-foreground"
          )}
        >
          <Menu />
        </Button>
      </div>
      <MobileMoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </nav>
  );
}
