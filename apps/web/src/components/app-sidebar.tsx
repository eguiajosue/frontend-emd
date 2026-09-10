"use client"

import {
  LogOut,
  Settings,
  Download,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Sidebar,
  SidebarContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "./ui/sidebar";
import { useSession } from "next-auth/react";
import { logout } from "@/lib/logout";
import { Separator } from "./ui/separator";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Button } from "./ui/button";
import { ThemeToggle } from "./ThemeToggle";
import { BugReportDialog } from "./BugReportDialog";
import { isOperationalOnly } from "@/lib/roleTaskMapping";
import { useChatUnreadCount } from "@/hooks/useChat";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { useUnreadNotificationsCount } from "@/hooks/useNotifications";
import { useMotionPreset } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { OPERATIONAL_MENU, buildMenuItems, isNavItemVisible } from "@/lib/navMenu";

/** Saludo según la hora del día, en vez de un genérico "Bienvenid@" fijo. */
function getTimeBasedGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return "Buenas noches";
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

function ConfiguracionLink({ pathname }: { pathname: string }) {
  const active = pathname === "/dashboard/configuracion";
  const { state, isMobile } = useSidebar();
  const collapsed = !isMobile && state === "collapsed";
  return (
    <Button
      variant="ghost"
      className={cn(
        "gap-2 mb-2",
        collapsed ? "mx-auto size-8 justify-center p-0" : "w-full justify-start",
        active && "bg-primary/10 text-primary"
      )}
      asChild
    >
      <a href="/dashboard/configuracion" title={collapsed ? "Configuración" : undefined}>
        <Settings className="h-4 w-4 shrink-0" />
        {!collapsed && "Configuración"}
      </a>
    </Button>
  );
}

/**
 * Botón discreto de "Instalar app", visible sólo cuando el navegador
 * disparó `beforeinstallprompt` (ver `useInstallPrompt`) — no hay forma de
 * saber si es instalable de antemano, así que el botón directamente no
 * existe hasta ese momento en vez de mostrarse deshabilitado.
 */
function InstallAppButton() {
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

export function AppSidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const userRoles = session?.user?.roles || [];
  const operationalOnly = isOperationalOnly(userRoles);

  // El saludo depende de la hora local del navegador; se calcula sólo tras
  // montar para evitar un mismatch de hidratación entre servidor y cliente
  // (en el server siempre cae en "Buenas noches" por defecto, invisible al
  // usuario porque el mount es prácticamente instantáneo).
  const [greeting, setGreeting] = useState("Bienvenid@");
  useEffect(() => setGreeting(getTimeBasedGreeting()), []);

  // Badge de mensajes de chat sin leer: se deriva de la misma query que usa
  // la pantalla del chat, invalidada en vivo por `useSocket`.
  const chatUnread = useChatUnreadCount();
  // Mismo criterio para el ítem "Notificaciones": comparte la query con la
  // campanita del header, así ambos resaltan a la vez.
  const { count: notificationsUnread } = useUnreadNotificationsCount();
  const { reduced: reducedMotion } = useMotionPreset();

  // Definición de grupos/ítems compartida con `useVisibleNavItems` (barra
  // móvil): una sola fuente para "qué puede ver cada rol".
  const visibleGroups = operationalOnly ? OPERATIONAL_MENU : buildMenuItems(userRoles);
  const { state, isMobile, toggleSidebar } = useSidebar();
  // El estado "collapsed" (rail de sólo íconos) es un modo exclusivo de
  // escritorio. En móvil el menú vive dentro de una hoja a ancho completo
  // (ver Sidebar en ui/sidebar.tsx): si se hereda la cookie de escritorio
  // colapsada, las etiquetas de texto desaparecían aunque hubiera espacio
  // de sobra para mostrarlas.
  const collapsed = !isMobile && state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      <SidebarContent data-tour="sidebar-nav">
        <SidebarHeader className={cn("p-4 pb-5 md:pb-4", collapsed && "px-2")}>
          {collapsed ? (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-heading text-sm font-bold text-primary-foreground">
              E
            </div>
          ) : (
            <div className="space-y-3">
              {/* Fila de marca: sólo en el panel expandido de escritorio — en
                  el Sheet móvil competiría con la tarjeta de identidad de
                  abajo, que ya cumple ese rol de "confirmar dónde estoy". */}
              {!isMobile && (
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary font-heading text-xs font-bold text-primary-foreground">
                    E
                  </div>
                  <span className="font-heading text-sm font-semibold tracking-tight">
                    EMD Bordados
                  </span>
                </div>
              )}
              <h2 className="font-heading text-lg font-semibold tracking-tight">
                {greeting},{" "}
                <span className="text-primary">{session?.user?.first_name}</span>
              </h2>
              {/* Identidad + rol arriba: sólo en móvil (el drawer se abre "en
                  frío" y conviene confirmar de inmediato la cuenta activa).
                  En escritorio la misma info ya vive al fondo del rail, donde
                  no compite con la navegación. */}
              <div className="flex items-center gap-3 rounded-xl bg-sidebar-accent/40 p-2.5 md:hidden">
                <div className="relative shrink-0">
                  <Avatar className="h-9 w-9 ring-2 ring-primary/20">
                    <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                      {session?.user?.username?.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span
                    aria-hidden
                    className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-sidebar"
                  />
                </div>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">
                    {session?.user?.first_name} {session?.user?.last_name}
                  </span>
                  <span className="truncate text-xs capitalize text-muted-foreground">
                    {userRoles.join(", ")}
                  </span>
                </div>
              </div>
            </div>
          )}
        </SidebarHeader>
        {visibleGroups.map((group) => (
          <div key={group.groupLabel}>
            <SidebarGroupLabel className="text-[0.7rem] font-semibold uppercase tracking-wider md:text-xs md:font-medium md:normal-case md:tracking-normal">
              {group.groupLabel}
            </SidebarGroupLabel>
            <SidebarMenu className="gap-1.5 md:gap-1">
              {group.items.map((item) =>
                isNavItemVisible(item, userRoles, operationalOnly) ? (() => {
                  // Ítems con contador de pendientes: chat y notificaciones.
                  // Ambos resaltan el ícono y muestran el número, expandidos o
                  // en el rail colapsado.
                  const unread =
                    item.url === "/dashboard/chat"
                      ? chatUnread
                      : item.url === "/dashboard/notificaciones"
                      ? notificationsUnread
                      : 0;
                  const active = pathname === item.url;
                  const highlighted = unread > 0 && !active;
                  return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={active}>
                      <a
                        href={item.url}
                        className={cn("relative", highlighted && "text-primary")}
                        data-tour={item.title === "Ayuda" ? "help-link" : undefined}
                      >
                        {active && (
                          <motion.span
                            layoutId="sidebar-active-indicator"
                            className="pointer-events-none absolute inset-0 -z-10 rounded-md bg-primary/10"
                            transition={{ type: "spring", stiffness: 400, damping: 35 }}
                          />
                        )}
                        {/* Fondo tenue permanente mientras haya pendientes. */}
                        {highlighted && (
                          <span
                            aria-hidden
                            className="pointer-events-none absolute inset-0 -z-10 rounded-md bg-primary/10"
                          />
                        )}
                        <motion.span
                          aria-hidden
                          className="flex"
                          animate={
                            unread > 0 && !reducedMotion
                              ? { rotate: [0, -10, 8, -5, 0] }
                              : { rotate: 0 }
                          }
                          transition={{ duration: 0.6, ease: "easeInOut" }}
                        >
                          <item.icon
                            className={active || highlighted ? "text-primary" : undefined}
                          />
                        </motion.span>
                        {!collapsed && (
                          <span
                            className={cn(
                              active && "font-medium text-primary",
                              highlighted && "font-medium"
                            )}
                          >
                            {item.title}
                          </span>
                        )}
                        {!collapsed && unread > 0 ? (
                          <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                            {unread > 99 ? "99+" : unread}
                          </span>
                        ) : null}
                      </a>
                    </SidebarMenuButton>
                    {/* Colapsado el badge va sobre el `li` (relative) y no dentro
                        del botón, que tiene `overflow-hidden` y lo recortaría. */}
                    {collapsed && unread > 0 ? (
                      <span className="pointer-events-none absolute -right-0.5 -top-0.5 z-10 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground ring-2 ring-sidebar">
                        {unread > 99 ? "99+" : unread}
                      </span>
                    ) : null}
                    {/* Barra de acento sólida en el borde izquierdo del rail,
                        sólo en el estado colapsado (referencia A) — aditiva al
                        fondo tenue de `sidebar-active-indicator`, no lo
                        reemplaza. El `li` no tiene padding propio, así que
                        `left-0` ya queda a ras del borde real del rail. */}
                    {collapsed && active ? (
                      <span
                        aria-hidden
                        className="pointer-events-none absolute left-0 top-1/2 z-10 h-5 w-[3px] -translate-y-1/2 rounded-full bg-primary"
                      />
                    ) : null}
                  </SidebarMenuItem>
                  );
                })() : null
              )}
            </SidebarMenu>
          </div>
        ))}
      </SidebarContent>
      <div className={cn("mt-auto p-4", collapsed && "px-2")}>
        {/* Chevron de colapsar/expandir el rail, sólo escritorio (en móvil el
            menú es el Sheet a ancho completo, no tiene estado colapsado). Es
            aditivo al `SidebarTrigger` de la barra superior — ambos controles
            hacen lo mismo, como en la referencia A. */}
        {!isMobile && (
          <div className={cn("mb-2 flex", collapsed ? "justify-center" : "justify-end")}>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
              <span className="sr-only">
                {collapsed ? "Expandir menú" : "Colapsar menú"}
              </span>
            </Button>
          </div>
        )}
        <Separator className="mb-4" />
        <InstallAppButton />
        <ConfiguracionLink pathname={pathname} />
        {!collapsed && <BugReportDialog />}
        {/* Ya se muestra arriba, junto al saludo, en móvil (ver
            SidebarHeader) — repetirla aquí duplicaría avatar+rol en la misma
            pantalla. En escritorio sigue siendo el único lugar donde aparece. */}
        <div
          className={cn(
            "hidden items-center gap-3 mb-4 mt-2 md:flex",
            collapsed && "flex-col gap-2"
          )}
        >
          <div className="relative shrink-0">
            <Avatar className="ring-2 ring-primary/20">
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {session?.user?.username?.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {/* Punto de estado "en línea": sesión activa ahora mismo. */}
            <span
              aria-hidden
              className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-sidebar animate-pulse motion-reduce:animate-none"
            />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium truncate">{session?.user.first_name} {session?.user.last_name}</span>
              <div className="flex justify-between items-center w-full gap-2">
                <span className="text-xs text-muted-foreground truncate">{userRoles.join(", ")}</span>
                <span className="text-xs text-muted-foreground shrink-0">@{session?.user.username}</span>
              </div>
            </div>
          )}
          <span data-tour="theme-toggle">
            <ThemeToggle />
          </span>
        </div>
        <Button
          variant="destructive"
          className={cn(collapsed ? "mx-auto size-8 p-0" : "w-full")}
          onClick={() => void logout()}
          title={collapsed ? "Logout" : undefined}
        >
          <LogOut className={cn("h-4 w-4", !collapsed && "mr-2")} />
          {!collapsed && "Logout"}
        </Button>
      </div>
    </Sidebar>
  );
}
