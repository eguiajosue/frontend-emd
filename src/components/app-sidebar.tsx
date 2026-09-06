"use client"

import {
  Package,
  PackagePlus,
  UserRound,
  Building,
  LogOut,
  LayoutDashboard,
  ClipboardList,
  HelpCircle,
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

export function AppSidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const userRoles = session?.user?.roles || [];

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
          title: "Mis Tareas",
          url: "/dashboard/mis-tareas",
          icon: ClipboardList,
          roles: [
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
      groupLabel: "Órdenes",
      items: [
        {
          title: "Tablero de Estatus",
          url: "/dashboard/orderstatus",
          icon: Package,
          roles: ["admin", "recepcion", "taller"],
        },
        {
          title: "Lista de Pedidos",
          url: "/dashboard/orders",
          icon: Package,
          roles: ["admin", "recepcion"],
        },
        {
          title: "Nueva Orden",
          url: "/dashboard/orders/new",
          icon: PackagePlus,
          roles: ["admin", "recepcion"],
        },
      ],
    },
    {
      groupLabel: "Clientes",
      items: [
        {
          title: "Lista de Clientes",
          url: "/dashboard/clients",
          icon: UserRound,
          roles: ["admin", "recepcion"],
        },
      ],
    },
    {
      groupLabel: "Empresas",
      items: [
        {
          title: "Lista de Empresas",
          url: "/dashboard/companies",
          icon: Building,
          roles: ["admin", "recepcion"],
        },
      ],
    },
    {
      groupLabel: "Usuarios y Roles",
      items: [
        {
          title: "Lista de Usuarios",
          url: "/dashboard/users",
          icon: UserRound,
          roles: ["admin"],
        },
        {
          title: "Lista de Roles",
          url: "/dashboard/roles",
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

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarHeader className="p-4">
          <h2 className="text-lg font-semibold tracking-tight">
            Bienvenid@,{" "}
            <span className="text-primary">{session?.user?.first_name}</span>
          </h2>
        </SidebarHeader>
        {menuItems.map((group) => (
          <div key={group.groupLabel}>
            <SidebarGroupLabel>{group.groupLabel}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) =>
                // Mostrar el botón si el usuario tiene "admin" o si tiene al menos uno de los roles permitidos
                userRoles.includes("admin") ||
                userRoles.some((r) => item.roles.includes(r)) ? (
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
        <div className="flex items-center gap-3 mb-4">
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
