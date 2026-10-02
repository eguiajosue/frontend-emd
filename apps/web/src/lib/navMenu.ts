import {
  Package,
  UserRound,
  LayoutDashboard,
  HelpCircle,
  TrendingUp,
  History,
  Bell,
  MessagesSquare,
  CalendarDays,
  Boxes,
  Building2,
  ClipboardList,
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

/**
 * Menú completo (roles administrativos/recepción). Cuatro secciones de
 * trabajo en vez de un grupo por página: antes eran 8 grupos para ~12
 * destinos, con varios grupos de un solo ítem que repetían su propio nombre.
 * El trabajo diario (Operación) va primero; la administración, al final.
 * Los grupos que el rol no puede ver se ocultan en el sidebar.
 */
export function buildMenuItems(userRoles: string[]): NavGroup[] {
  return [
    {
      groupLabel: "Operación",
      items: [
        {
          title: "Panel General",
          url: "/dashboard/admin",
          icon: LayoutDashboard,
          roles: ["admin", "superuser"],
        },
        {
          // "Pedidos" para quien administra, "Tareas asignadas" para quien
          // sólo ejecuta: es la misma pantalla, no significa lo mismo.
          title: ordersScreenTitle(userRoles),
          url: "/dashboard/orders",
          icon: Package,
          roles: ALL_ROLES,
        },
        {
          // Calendario de equipo de Recepción: instalaciones, juntas, visitas.
          title: "Calendario",
          url: "/dashboard/calendario",
          icon: CalendarDays,
          roles: ["admin", "recepcion", "superuser"],
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
      groupLabel: "Compras y clientes",
      items: [
        {
          // Checklist de compra por pedido, con prioridad arrastrable.
          title: "Hoja de Materiales",
          url: "/dashboard/hoja-materiales",
          icon: ClipboardList,
          roles: ["admin", "recepcion", "superuser"],
        },
        {
          // Catálogo de materiales/insumos + proveedores (tabs adentro).
          title: "Materiales",
          url: "/dashboard/materiales",
          icon: Boxes,
          roles: ["admin", "recepcion", "superuser"],
        },
        {
          title: "Clientes",
          url: "/dashboard/clientes",
          icon: Building2,
          roles: ["admin", "recepcion", "superuser"],
        },
      ],
    },
    {
      groupLabel: "Equipo",
      items: [
        {
          title: "Chat interno",
          url: "/dashboard/chat",
          icon: MessagesSquare,
          // Canales de área y DMs visibles los resuelve el backend.
          roles: ALL_ROLES,
        },
        {
          title: "Notificaciones",
          url: "/dashboard/notificaciones",
          icon: Bell,
          roles: ALL_ROLES,
        },
        {
          title: "Ayuda",
          url: "/dashboard/ayuda",
          icon: HelpCircle,
          roles: ALL_ROLES,
        },
      ],
    },
    {
      groupLabel: "Administración",
      items: [
        {
          title: "Rendimiento",
          url: "/dashboard/admin/rendimiento",
          icon: TrendingUp,
          roles: ["admin", "superuser"],
        },
        {
          title: "Usuarios",
          url: "/dashboard/usuarios",
          icon: UserRound,
          roles: ["admin", "superuser"],
        },
      ],
    },
  ];
}

/**
 * Orden de prioridad para elegir los tabs principales de la barra móvil: se
 * recorre esta lista y se toman los primeros `MAX_PRIMARY_TABS` ítems que el
 * rol actual puede ver. Vive acá (no en `MobileTabBar.tsx`) para que
 * `MobileMoreSheet.tsx` pueda derivar el resto de la lista ("Más") a partir
 * de la misma fuente y ambas superficies nunca diverjan sobre qué ítem es
 * "principal" y cuál queda detrás de "Más".
 */
export const TAB_PRIORITY_URLS = [
  "/dashboard/admin",
  "/dashboard/orders",
  "/dashboard/chat",
  "/dashboard/notificaciones",
  "/dashboard/admin/rendimiento",
  "/dashboard/hoja-materiales",
  "/dashboard/historial",
  "/dashboard/clientes",
  "/dashboard/materiales",
  "/dashboard/calendario",
  "/dashboard/usuarios",
  "/dashboard/ayuda",
];

export const MAX_PRIMARY_TABS = 4;

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

/**
 * URL del ítem que corresponde a `pathname`: coincidencia exacta o la ruta más
 * específica que la contiene. Así `/dashboard/orders/123` mantiene marcado
 * "Pedidos", y `/dashboard/admin/rendimiento` marca "Rendimiento" y no
 * "Panel General" (`/dashboard/admin`), que también es prefijo.
 */
export function findActiveNavUrl(urls: string[], pathname: string | null): string | null {
  if (!pathname) return null;
  let best: string | null = null;
  for (const url of urls) {
    if (pathname === url || pathname.startsWith(`${url}/`)) {
      if (!best || url.length > best.length) best = url;
    }
  }
  return best;
}

/** Inicio de cada rol: admin al panel, el resto directo a su trabajo. */
export function homePathForRoles(roles: string[]): string {
  return roles.includes("admin") || roles.includes("superuser")
    ? "/dashboard/admin"
    : "/dashboard/orders";
}
