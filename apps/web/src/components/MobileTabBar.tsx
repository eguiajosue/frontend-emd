"use client";

import { Menu } from "lucide-react";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/ui/sidebar";
import { useVisibleNavItems, type VisibleNavItem } from "@/hooks/useVisibleNavItems";

/**
 * Orden de prioridad para elegir los 4 tabs principales: se recorre esta
 * lista y se toman los primeros 4 ítems que el rol actual puede ver (mismo
 * criterio de rol que ya filtra `app-sidebar.tsx`, vía `useVisibleNavItems`,
 * así que nunca puede mostrar algo que el rail no mostraría). Cualquier otro
 * ítem del menú completo queda detrás del tab "Más".
 */
const TAB_PRIORITY_URLS = [
  "/dashboard/admin",
  "/dashboard/orders",
  "/dashboard/chat",
  "/dashboard/notificaciones",
  "/dashboard/admin/rendimiento",
  "/dashboard/historial",
  "/dashboard/clientes",
  "/dashboard/usuarios",
  "/dashboard/ayuda",
];

const MAX_PRIMARY_TABS = 4;

/**
 * Barra de tabs flotante para móvil (referencia B). No es un segundo menú:
 * es un atajo a los 4 destinos más usados del rol actual, más un tab "Más"
 * que abre el mismo Sheet de `app-sidebar.tsx` con el menú completo, config,
 * tema y logout — esa sigue siendo la única superficie con esa lista.
 */
export function MobileTabBar() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const visibleItems = useVisibleNavItems();

  const primaryTabs = TAB_PRIORITY_URLS.map((url) =>
    visibleItems.find((item) => item.url === url)
  )
    .filter((item): item is VisibleNavItem => Boolean(item))
    .slice(0, MAX_PRIMARY_TABS);

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:hidden"
    >
      <div className="inline-flex items-center gap-1 rounded-full bg-card p-1.5 shadow-soft-md">
        {primaryTabs.map((item) => {
          // /dashboard/admin y /dashboard/admin/rendimiento son rutas
          // distintas: comparación exacta, nunca por prefijo.
          const active = pathname === item.url;
          return (
            <a
              key={item.url}
              href={item.url}
              aria-current={active ? "page" : undefined}
              aria-label={item.title}
              title={item.title}
              className="relative flex h-12 w-12 flex-col items-center justify-center gap-1 rounded-2xl"
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
              {/* Punto bajo el ícono activo: se reserva el espacio siempre
                  (opacidad 0 en reposo) para que no salte el layout al
                  cambiar de tab. */}
              <span
                aria-hidden
                className={cn(
                  "h-1 w-1 rounded-full bg-primary transition-opacity",
                  active ? "opacity-100" : "opacity-0"
                )}
              />
            </a>
          );
        })}
        <button
          type="button"
          onClick={() => setOpenMobile(true)}
          aria-label="Más opciones"
          title="Más"
          className="relative flex h-12 w-12 flex-col items-center justify-center gap-1 rounded-2xl text-muted-foreground"
        >
          <Menu className="h-5 w-5" />
          <span aria-hidden className="h-1 w-1 rounded-full opacity-0" />
        </button>
      </div>
    </nav>
  );
}
