"use client"

import { LogOut, Settings, Download } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useSidebar } from "./ui/sidebar";
import { useSession } from "next-auth/react";
import { logout } from "@/lib/logout";
import { Button } from "./ui/button";
import { SimpleTooltip } from "./ui/tooltip";
import { ThemeRailSwitch } from "./ThemeToggle";
import { isOperationalOnly } from "@/lib/roleTaskMapping";
import { useChatUnreadCount } from "@/hooks/useChat";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { useUnreadNotificationsCount } from "@/hooks/useNotifications";
import { useMotionPreset } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { OPERATIONAL_MENU, buildMenuItems, findActiveNavUrl, isNavItemVisible } from "@/lib/navMenu";
import { useOrderViewCounts } from "./SidebarOrderViews";

const ORDERS_URL = "/dashboard/orders";

/** Exportado también para `MobileMoreSheet.tsx`, que reutiliza este botón tal
 *  cual en vez de duplicar su JSX/lógica de "colapsado". */
export function ConfiguracionLink({ pathname }: { pathname: string }) {
  const active = pathname === "/dashboard/configuracion";
  const { state, isMobile } = useSidebar();
  const collapsed = !isMobile && state === "collapsed";
  return (
    <Button
      variant="ghost"
      className={cn(
        "gap-2 mb-2",
        collapsed ? "mx-auto size-8 justify-center p-0" : "w-full justify-start",
        active && "bg-muted font-medium text-foreground"
      )}
      asChild
    >
      <Link href="/dashboard/configuracion" title={collapsed ? "Configuración" : undefined}>
        <Settings className="h-4 w-4 shrink-0" />
        {!collapsed && "Configuración"}
      </Link>
    </Button>
  );
}

/**
 * Botón discreto de "Instalar app", visible sólo cuando el navegador
 * disparó `beforeinstallprompt` (ver `useInstallPrompt`) — no hay forma de
 * saber si es instalable de antemano, así que el botón directamente no
 * existe hasta ese momento en vez de mostrarse deshabilitado.
 */
export function InstallAppButton() {
  const { canInstall, promptInstall } = useInstallPrompt();
  const { state, isMobile } = useSidebar();
  const collapsed = !isMobile && state === "collapsed";

  if (!canInstall) return null;

  return (
    <Button
      variant="ghost"
      className={cn(
        "gap-2 mb-2 text-primary hover:text-primary",
        collapsed ? "mx-auto size-8 justify-center p-0" : "w-full justify-start"
      )}
      onClick={promptInstall}
      title={collapsed ? "Instalar app" : undefined}
    >
      <Download className="h-4 w-4 shrink-0" />
      {!collapsed && "Instalar app"}
    </Button>
  );
}

/** Segmento flotante del riel: píldora blanca vertical, como en la referencia. */
function RailSegment({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "flex w-[3.75rem] shrink-0 flex-col items-center gap-1 rounded-full border border-border/60 bg-sidebar p-2 shadow-soft dark:border-border",
        className
      )}
    >
      {children}
    </div>
  );
}

/** Contador sobre un ícono del riel (no leídos, vencidos). */
function RailCount({ value, tone = "primary", label }: { value: number; tone?: "primary" | "danger"; label?: string }) {
  return (
    <span
      title={label}
      className={cn(
        "pointer-events-none absolute -right-0.5 -top-0.5 z-10 inline-flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-none ring-2 ring-sidebar",
        tone === "danger" ? "bg-rose-600 text-white" : "bg-primary text-primary-foreground"
      )}
    >
      {value > 99 ? "99+" : value}
    </span>
  );
}

/**
 * Riel de escritorio: tres píldoras flotantes sobre el lienzo — tema arriba,
 * navegación al medio (agrupada, con separadores entre grupos) y cuenta abajo.
 * Sólo íconos con tooltip: las etiquetas del grupo activo se leen en la barra
 * superior (`AppTopBar`). En móvil no existe: navega `MobileTabBar` + "Más".
 */
export function AppSidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const userRoles = session?.user?.roles || [];
  const operationalOnly = isOperationalOnly(userRoles);

  // Badges de no leídos: misma query que el chat y la campanita, invalidada
  // en vivo por `useSocket`.
  const chatUnread = useChatUnreadCount();
  const { count: notificationsUnread } = useUnreadNotificationsCount();
  const { reduced: reducedMotion } = useMotionPreset();

  // Grupos sin ningún ítem visible para el rol no se pintan.
  const visibleGroups = (operationalOnly ? OPERATIONAL_MENU : buildMenuItems())
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => isNavItemVisible(item, userRoles, operationalOnly)),
    }))
    .filter((group) => group.items.length > 0);
  const activeUrl = findActiveNavUrl(
    visibleGroups.flatMap((group) => group.items.map((item) => item.url)),
    pathname
  );
  const showsOrders = visibleGroups.some((group) => group.items.some((item) => item.url === ORDERS_URL));
  // Los vencidos se avisan como badge sobre el ícono de Pedidos.
  const { overdue } = useOrderViewCounts(showsOrders);
  const { isMobile } = useSidebar();
  // Al entrar a una pantalla del fondo del menú, su ícono se trae a la vista.
  const navScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    navScrollRef.current
      ?.querySelector<HTMLElement>('[aria-current="page"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [activeUrl]);

  // Todos los hooks de arriba se llaman siempre (regla de hooks); en móvil
  // sólo se omite el JSX.
  if (isMobile) return null;

  const settingsActive = pathname === "/dashboard/configuracion";

  return (
    <aside
      aria-label="Navegación principal"
      className="fixed bottom-4 left-4 top-[5.25rem] z-30 hidden flex-col items-center gap-3 md:flex"
    >
      <RailSegment>
        <span data-tour="theme-toggle">
          <ThemeRailSwitch />
        </span>
      </RailSegment>

      <RailSegment className="min-h-0 shrink overflow-hidden px-0 py-0">
        <nav
          ref={navScrollRef}
          data-tour="sidebar-nav"
          aria-label="Secciones"
          className="flex min-h-0 w-full flex-col items-center gap-1 overflow-y-auto overflow-x-hidden px-2 py-2 [scrollbar-width:none]"
        >
          {visibleGroups.map((group, groupIndex) => (
            <Fragment key={group.groupLabel}>
              {groupIndex > 0 && (
                <span aria-hidden className="my-1 h-px w-6 shrink-0 bg-border" />
              )}
              <ul aria-label={group.groupLabel} className="flex flex-col items-center gap-1">
                {group.items.map((item) => {
                  const unread =
                    item.url === "/dashboard/chat"
                      ? chatUnread
                      : item.url === "/dashboard/notificaciones"
                      ? notificationsUnread
                      : 0;
                  const active = activeUrl === item.url;
                  return (
                    <li key={item.url} className="relative">
                      <SimpleTooltip label={item.title} side="right">
                        <Link
                          href={item.url}
                          aria-label={item.title}
                          aria-current={active ? "page" : undefined}
                          data-tour={item.title === "Ayuda" ? "help-link" : undefined}
                          className={cn(
                            "relative flex h-11 w-11 items-center justify-center rounded-full text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                            active && "text-sidebar-primary-foreground hover:bg-transparent hover:text-sidebar-primary-foreground",
                            !active && unread > 0 && "text-primary"
                          )}
                        >
                          {active && (
                            <motion.span
                              layoutId="rail-active-indicator"
                              className="pointer-events-none absolute inset-0 -z-0 rounded-full bg-sidebar-primary"
                              transition={
                                reducedMotion
                                  ? { duration: 0 }
                                  : { type: "spring", stiffness: 400, damping: 35 }
                              }
                            />
                          )}
                          <motion.span
                            aria-hidden
                            className="relative flex"
                            animate={
                              unread > 0 && !reducedMotion
                                ? { rotate: [0, -10, 8, -5, 0] }
                                : { rotate: 0 }
                            }
                            transition={{ duration: 0.6, ease: "easeInOut" }}
                          >
                            <item.icon className="h-[1.15rem] w-[1.15rem]" />
                          </motion.span>
                        </Link>
                      </SimpleTooltip>
                      {item.url === ORDERS_URL && overdue > 0 ? (
                        <RailCount
                          value={overdue}
                          tone="danger"
                          label={`${overdue} vencido${overdue === 1 ? "" : "s"}`}
                        />
                      ) : null}
                      {unread > 0 ? <RailCount value={unread} /> : null}
                    </li>
                  );
                })}
              </ul>
            </Fragment>
          ))}
        </nav>
      </RailSegment>

      <div className="flex-1" aria-hidden />

      <RailSegment>
        <SimpleTooltip label="Configuración" side="right">
          <Link
            href="/dashboard/configuracion"
            aria-label="Configuración"
            aria-current={settingsActive ? "page" : undefined}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
              settingsActive && "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground"
            )}
          >
            <Settings className="h-[1.15rem] w-[1.15rem]" />
          </Link>
        </SimpleTooltip>
        <SimpleTooltip label="Cerrar sesión" side="right">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Cerrar sesión"
            onClick={() => void logout()}
            className="h-10 w-10 text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="!size-[1.15rem]" />
          </Button>
        </SimpleTooltip>
      </RailSegment>
    </aside>
  );
}
