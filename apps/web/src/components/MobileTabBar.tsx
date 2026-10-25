"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import { Button } from "@/components/ui/button";
import { useVisibleNavItems, type VisibleNavItem } from "@/hooks/useVisibleNavItems";
import { useNavLayout } from "@/hooks/useNavLayout";
import { SPRING_LAYOUT } from "@/lib/motion";
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
  const visibleItems = useVisibleNavItems();
  const [moreOpen, setMoreOpen] = useState(false);
  const reducedMotion = useReducedMotion();

  // Favoritos del usuario primero; luego la prioridad por defecto, sin
  // ocultos (fuente única con el riel y "Más": `useNavLayout`).
  const { primaryTabUrls, activeUrl } = useNavLayout();
  const primaryTabs = primaryTabUrls
    .map((url) => visibleItems.find((item) => item.url === url))
    .filter((item): item is VisibleNavItem => Boolean(item));

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:hidden"
    >
      {/* Píldora marina flotante, mismo lenguaje que el riel de escritorio:
          íconos y el destino activo resaltado, que además se estira para
          mostrar su nombre corto. */}
      <div className="inline-flex items-center gap-1 rounded-[1.375rem] border border-sidebar-border bg-sidebar p-1.5 shadow-soft-lg">
        {primaryTabs.map((item) => {
          const active = activeUrl === item.url;
          return (
            <Link
              key={item.url}
              href={item.url}
              aria-current={active ? "page" : undefined}
              aria-label={item.title}
              onClick={() => !active && haptic("light")}
              className={cn(
                "relative flex h-12 items-center justify-center gap-2 rounded-2xl transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/80",
                active
                  ? "px-4 text-sidebar-primary-foreground"
                  : "w-12 text-sidebar-foreground/75 hover:bg-white/10 hover:text-white"
              )}
            >
              {active && (
                <motion.span
                  layoutId="mobile-tabbar-highlight"
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-2xl bg-sidebar-primary ring-1 ring-white/10"
                  transition={reducedMotion ? { duration: 0 } : SPRING_LAYOUT}
                />
              )}
              <span className="relative">
                <item.icon className={cn("h-5 w-5 transition-colors duration-150", active && "text-cyan")} />
                {item.unreadCount > 0 && (
                  <span className="pointer-events-none absolute -right-2 -top-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-magenta-strong px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-sidebar">
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
            "h-12 w-12 rounded-2xl p-0 text-sidebar-foreground/75 hover:bg-white/10 hover:text-white focus-visible:ring-sidebar-ring/80 focus-visible:ring-offset-0 [&_svg]:size-5",
            moreOpen && "bg-white/10 text-white"
          )}
        >
          <Menu />
        </Button>
      </div>
      <MobileMoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </nav>
  );
}
