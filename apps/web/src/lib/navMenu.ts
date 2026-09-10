import {
  Package,
  UserRound,
  LayoutDashboard,
  HelpCircle,
  TrendingUp,
  History,
  Bell,
  MessagesSquare,
  type LucideIcon,
} from "lucide-react";
import { ordersScreenTitle } from "./orderScreen";

export interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  /** Roles que pueden ver el ítem; ausente = visible para cualquiera. */
  roles?: string[];
}

export interface NavGroup {
  groupLabel: string;
  items: NavItem[];
}

const ALL_ROLES = [
  "admin",
  "superuser",
  "recepcion",
  "taller",
  "dtf",
  "bordado",
  "diseno",
  "laser",
  "impresiones",
];

/**
 * Menú reducido para roles puramente operativos (dtf, bordado, diseno, laser,
 * taller, impresiones): sólo necesitan ver el estatus de sus pedidos y Ayuda,
 * nada de métricas ni gestión editable. Fuente única para `app-sidebar.tsx`
 * (rail de escritorio) y `MobileTabBar.tsx` (barra flotante móvil), vía
 * `useVisibleNavItems`.
 */
export const OPERATIONAL_MENU: NavGroup[] = [
  {
    groupLabel: "Producción",
    items: [
      // Una sola pantalla de trabajo. "Mi trabajo" mostraba lo mismo que
      // "Pedidos" con otra forma; el nombre cambia según el rol
      // (`ordersScreenTitle`), no la pantalla.
      {
        title: "Tareas asignadas",
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

/** Menú completo (roles administrativos/recepción), agrupado igual que hoy. */
export function buildMenuItems(userRoles: string[]): NavGroup[] {
  return [
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
          // "Pedidos" para quien administra, "Tareas asignadas" para quien
          // sólo ejecuta: es la misma pantalla, no significa lo mismo.
          title: ordersScreenTitle(userRoles),
          url: "/dashboard/orders",
          icon: Package,
          roles: ALL_ROLES,
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
          roles: ["admin", "recepcion", "superuser"],
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
          roles: ALL_ROLES,
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
          roles: ALL_ROLES,
        },
        {
          title: "Ayuda",
          url: "/dashboard/ayuda",
          icon: HelpCircle,
          // Visible para todos los roles.
          roles: ALL_ROLES,
        },
      ],
    },
  ];
}

/**
 * El menú operativo ya viene pre-filtrado (sin `roles`); el menú completo se
 * filtra por rol, con "admin" viendo todo.
 */
export function isNavItemVisible(
  item: NavItem,
  userRoles: string[],
  operationalOnly: boolean
): boolean {
  return (
    operationalOnly ||
    userRoles.includes("admin") ||
    userRoles.some((r) => (item.roles ? item.roles.includes(r) : true))
  );
}
