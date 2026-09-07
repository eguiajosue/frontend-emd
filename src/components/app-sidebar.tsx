"use client"

import {
  Package,
  UserRound,
  LogOut,
  LayoutDashboard,
  HelpCircle,
  Settings,
  TrendingUp,
  History,
  Bell,
  MessagesSquare,
  ClipboardList,
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
import { useUnreadNotificationsCount } from "@/hooks/useNotifications";
import { useMotionPreset } from "@/lib/motion";
import { cn } from "@/lib/utils";

// Menú reducido para roles puramente operativos (dtf, bordado, diseno, laser,
// taller, impresiones): sólo necesitan ver el estatus de sus pedidos y Ayuda,
// nada de métricas ni gestión editable.
const OPERATIONAL_MENU = [
  {
    groupLabel: "Producción",
    items: [
      // Bandeja propia: sólo las tareas de las áreas del usuario, etiquetadas
      // con la suya (ver WORKFLOW.md §4 en el backend).
      {
        title: "Mi trabajo",
        url: "/dashboard/mi-trabajo",
        icon: ClipboardList,
      },
      {
        title: "Pedidos",
        url: "/dashboard/orders",
        icon: Package,
      },
    ],
  },
  {
    groupLabel: "Comunicación",
    items: [
      {
        title: "Chat interno",
        url: "/dashboard/chat",
        icon: MessagesSquare,
      },
    ],
  },
  {
    groupLabel: "Soporte",
    items: [
      {
        title: "Notificaciones",
        url: "/dashboard/notificaciones",
        icon: Bell,
      },
      {
        title: "Ayuda",
        url: "/dashboard/ayuda",
        icon: HelpCircle,
      },
    ],
  },
];

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
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
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

  // Áreas de producción reales (Diseño no es una: es la fase previa).
  const hasProductionArea = userRoles.some((r) =>
    ["taller", "dtf", "bordado", "laser", "impresiones", "recepcion", "admin", "superuser"].includes(r)
  );

  const menuItems = [
    {
      groupLabel: "Administración",
      items: [
        {
          title: "Panel General",
          url: "/dashboard/admin",
          icon: LayoutDashboard,
          roles: ["admin", "superuser"],
        },
        {
          title: "Rendimiento",
          url: "/dashboard/admin/rendimiento",
          icon: TrendingUp,
          roles: ["admin", "superuser"],
        },
      ],
    },
    {
      groupLabel: "Pedidos",
      items: [
        {
          title: "Mi trabajo",
          url: "/dashboard/mi-trabajo",
          icon: ClipboardList,
          // Bandeja de producción: no aplica a Diseño, que tiene su propio
          // circuito de montajes (WORKFLOW.md §4).
          roles: [
            "admin",
            "superuser",
            "recepcion",
            "taller",
            "dtf",
            "bordado",
            "laser",
            "impresiones",
          ],
        },
        {
          title: "Pedidos",
          url: "/dashboard/orders",
          icon: Package,
          roles: [
            "admin",
            "superuser",
            "recepcion",
            "taller",
            "dtf",
            "bordado",
            "diseno",
            "laser",
            "impresiones",
          ],
        },
        {
          title: "Historial",
          url: "/dashboard/historial",
          icon: History,
          roles: ["admin", "superuser", "recepcion"],
        },
      ],
    },
    {
      groupLabel: "Clientes",
      items: [
        {
          title: "Clientes",
          url: "/dashboard/clientes",
          icon: UserRound,
          roles: ["admin", "recepcion"],
        },
      ],
    },
    {
      groupLabel: "Usuarios",
      items: [
        {
          title: "Usuarios",
          url: "/dashboard/usuarios",
          icon: UserRound,
          roles: ["admin", "superuser"],
        },
      ],
    },
    {
      groupLabel: "Comunicación",
      items: [
        {
          title: "Chat interno",
          url: "/dashboard/chat",
          icon: MessagesSquare,
          // Visible para todos los roles: los canales de área y los DMs que
          // cada uno puede ver los resuelve el backend.
          roles: [
            "admin",
            "superuser",
            "recepcion",
            "taller",
            "dtf",
            "bordado",
            "diseno",
            "laser",
            "impresiones",
          ],
        },
      ],
    },
    {
      groupLabel: "Soporte",
      items: [
        {
          title: "Notificaciones",
          url: "/dashboard/notificaciones",
          icon: Bell,
          // Visible para todos los roles.
          roles: [
            "admin",
            "superuser",
            "recepcion",
            "taller",
            "dtf",
            "bordado",
            "diseno",
            "laser",
            "impresiones",
          ],
        },
        {
          title: "Ayuda",
          url: "/dashboard/ayuda",
          icon: HelpCircle,
          // Visible para todos los roles.
          roles: [
            "admin",
            "superuser",
            "recepcion",
            "taller",
            "dtf",
            "bordado",
            "diseno",
            "laser",
            "impresiones",
          ],
        },
      ],
    },
  ];

  const visibleGroups = operationalOnly ? OPERATIONAL_MENU : menuItems;
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      <SidebarContent data-tour="sidebar-nav">
        <SidebarHeader className={cn("p-4", collapsed && "px-2")}>
          {collapsed ? (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-heading text-sm font-bold text-primary-foreground">
              E
            </div>
          ) : (
            <h2 className="font-heading text-lg font-semibold tracking-tight">
              {greeting},{" "}
              <span className="text-primary">{session?.user?.first_name}</span>
            </h2>
          )}
        </SidebarHeader>
        {visibleGroups.map((group) => (
          <div key={group.groupLabel}>
            <SidebarGroupLabel>{group.groupLabel}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) =>
                // El menú operativo ya viene pre-filtrado (sin `roles`); el menú
                // completo se filtra por rol, con "admin" viendo todo.
                // "Mi trabajo" es la bandeja de producción: no tiene sentido
                // para quien no trabaja ninguna área de producción (ej. un
                // diseñador puro, que tiene su propio circuito de montajes).
                (item.url !== "/dashboard/mi-trabajo" || hasProductionArea) &&
                (operationalOnly ||
                  userRoles.includes("admin") ||
                  userRoles.some((r) =>
                    "roles" in item ? (item.roles as string[]).includes(r) : true
                  )) ? (() => {
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
                  </SidebarMenuItem>
                  );
                })() : null
              )}
            </SidebarMenu>
          </div>
        ))}
      </SidebarContent>
      <div className={cn("mt-auto p-4", collapsed && "px-2")}>
        <Separator className="mb-4" />
        <ConfiguracionLink pathname={pathname} />
        {!collapsed && <BugReportDialog />}
        <div
          className={cn(
            "flex items-center gap-3 mb-4 mt-2",
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
