"use client"

import {
  Package,
  PackagePlus,
  Truck,
  UserRound,
  UserPlus,
  Building,
  LogOut,
} from "lucide-react";
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

export function AppSidebar() {
  const { data: session } = useSession();
  const userRole = session?.user?.role;

  const menuItems = [
    {
      groupLabel: "Órdenes",
      items: [
        {
          title: "Lista de Órdenes",
          url: "/dashboard/orderstatus",
          icon: Package,
          roles: ["admin", "recepcion", "taller"],
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
          url: "/clients",
          icon: UserRound,
          roles: ["admin", "recepcion"],
        },
        {
          title: "Nuevo Cliente",
          url: "/clients/new",
          icon: UserPlus,
          roles: ["admin", "recepcion"],
        },
      ],
    },
    {
      groupLabel: "Inventario",
      items: [
        {
          title: "Lista de Productos",
          url: "/products",
          icon: Package,
          roles: ["admin", "taller"],
        },
        {
          title: "Movimientos de Inventario",
          url: "/inventory/transactions",
          icon: Truck,
          roles: ["admin", "taller"],
        },
      ],
    },
    {
      groupLabel: "Colores y Tamaños",
      items: [
        {
          title: "Lista de Colores",
          url: "/colors",
          icon: Package,
          roles: ["admin", "taller"],
        },
        {
          title: "Lista de Tamaños",
          url: "/sizes",
          icon: Package,
          roles: ["admin", "taller"],
        },
      ],
    },
    {
      groupLabel: "Empresas",
      items: [
        {
          title: "Lista de Empresas",
          url: "/companies",
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
          url: "/roles",
          icon: UserRound,
          roles: ["admin"],
        },
      ],
    },
  ];

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarHeader className="p-4">
          <h2 className="text-lg font-semibold tracking-tight">
            Bienvenid@, {session?.user?.first_name}
          </h2>
        </SidebarHeader>
        {menuItems.map((group) => (
          <div key={group.groupLabel}>
            <SidebarGroupLabel>{group.groupLabel}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) =>
                // Mostrar el botón si el usuario es "admin" o si el rol del usuario está en la lista de roles permitidos
                userRole === "admin" || item.roles.includes(session?.user.role) ? (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <a href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
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
          <Avatar>
            <AvatarFallback>
              {session?.user?.username?.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-medium">{session?.user.first_name} {session?.user.last_name}</span>
            <div className="flex justify-between items-center w-full">
              <span className="text-xs text-muted-foreground">{session?.user.role}</span>
              <span className="text-xs text-muted-foreground">@{session?.user.username}</span>
            </div>
          </div>
        </div>
        <Button variant="destructive" className="w-full" onClick={() => signOut()}>
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </Sidebar>
  );
}
