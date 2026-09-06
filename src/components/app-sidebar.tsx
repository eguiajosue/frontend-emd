"use client"

import {
  Package,
  UserRound,
  LogOut,
  LayoutDashboard,
  HelpCircle,
  Settings,
  TrendingUp,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Sidebar,
  SidebarContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "./ui/sidebar";
import { useSession, signOut } from "next-auth/react";
import { Separator } from "./ui/separator";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Button } from "./ui/button";
import { ThemeToggle } from "./ThemeToggle";
import { BugReportDialog } from "./BugReportDialog";
import { isOperationalOnly } from "@/lib/roleTaskMapping";
import { cn } from "@/lib/utils";

// Menú reducido para roles puramente operativos (dtf, bordado, diseno, laser,
// taller, impresiones): sólo necesitan ver el estatus de sus pedidos y Ayuda,
// nada de métricas ni gestión editable.
const OPERATIONAL_MENU = [
  {
    groupLabel: "Producción",
    items: [
      {
        title: "Pedidos",
        url: "/dashboard/orders",
        icon: Package,
      },
    ],
  },
  {
    groupLabel: "Soporte",
    items: [
      {
        title: "Ayuda",
        url: "/dashboard/ayuda",
        icon: HelpCircle,
      },
    ],
  },
];

function ConfiguracionLink({ pathname }: { pathname: string }) {
  const active = pathname === "/dashboard/configuracion";
  return (
    <Button
      variant="ghost"
      className={cn("w-full justify-start gap-2 mb-2", active && "bg-primary/10 text-primary")}
      asChild
    >
      <a href="/dashboard/configuracion">
        <Settings className="h-4 w-4" />
        Configuración
      </a>
    </Button>
  );
}

export function AppSidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const userRoles = session?.user?.roles || [];
  const operationalOnly = isOperationalOnly(userRoles);

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
          roles: ["admin"],
        },
      ],
    },
    {
      groupLabel: "Soporte",
      items: [
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

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarHeader className="p-4">
          <h2 className="text-lg font-semibold tracking-tight">
            Bienvenid@,{" "}
            <span className="text-primary">{session?.user?.first_name}</span>
          </h2>
        </SidebarHeader>
        {visibleGroups.map((group) => (
          <div key={group.groupLabel}>
            <SidebarGroupLabel>{group.groupLabel}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) =>
                // El menú operativo ya viene pre-filtrado (sin `roles`); el menú
                // completo se filtra por rol, con "admin" viendo todo.
                operationalOnly ||
                userRoles.includes("admin") ||
                userRoles.some((r) =>
                  "roles" in item ? (item.roles as string[]).includes(r) : true
                ) ? (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={pathname === item.url}>
                      <a href={item.url} className="relative">
                        {pathname === item.url && (
                          <motion.span
                            layoutId="sidebar-active-indicator"
                            className="absolute inset-0 -z-10 rounded-md bg-primary/10"
                            transition={{ type: "spring", stiffness: 400, damping: 35 }}
                          />
                        )}
                        <item.icon
                          className={pathname === item.url ? "text-primary" : undefined}
                        />
                        <span
                          className={
                            pathname === item.url ? "font-medium text-primary" : undefined
                          }
                        >
                          {item.title}
                        </span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ) : null
              )}
            </SidebarMenu>
          </div>
        ))}
      </SidebarContent>
      <div className="mt-auto p-4">
        <Separator className="mb-4" />
        <ConfiguracionLink pathname={pathname} />
        <BugReportDialog />
        <div className="flex items-center gap-3 mb-4 mt-2">
          <Avatar className="ring-2 ring-primary/20">
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {session?.user?.username?.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium truncate">{session?.user.first_name} {session?.user.last_name}</span>
            <div className="flex justify-between items-center w-full gap-2">
              <span className="text-xs text-muted-foreground truncate">{userRoles.join(", ")}</span>
              <span className="text-xs text-muted-foreground shrink-0">@{session?.user.username}</span>
            </div>
          </div>
          <ThemeToggle />
        </div>
        <Button variant="destructive" className="w-full" onClick={() => signOut()}>
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </Sidebar>
  );
}
