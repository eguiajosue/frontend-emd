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
  ListChecks,
  Truck,
  Warehouse,
  House,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  /** Roles que pueden ver el ítem; ausente = visible para cualquiera. */
  roles?: string[];
  /** Sólo esos roles, sin la excepción de admin (ej. una bandeja de trabajo propia). */
  strictRoles?: boolean;
}

export interface NavGroup {
  groupLabel: string;
  items: NavItem[];
}

/** Bandeja de tareas de Diseño y Producción. */
export const TASKS_URL = "/dashboard/tareas";

/**
 * Inicio de cada rol (tablero en vivo): Recepción ve el control de todas las
 * áreas; Diseño y Producción, su trabajo por prioridad. Ruta propia (no
 * `/dashboard`) para que no "coincida" como prefijo de todas las pantallas.
 */
export const HOME_URL = "/dashboard/inicio";

const HOME_ITEM: NavItem = { title: "Inicio", url: HOME_URL, icon: House };

/** Existencias físicas por departamento (no es el catálogo de Materiales). */
export const INVENTORY_URL = "/dashboard/inventario";

/** Roles que ejecutan trabajo (Diseño + áreas de producción). */
const WORK_AREA_ROLES = ["diseno", "taller", "dtf", "bordado", "laser", "impresiones"];

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
      HOME_ITEM,
      // Diseño y Producción no administran pedidos: trabajan tareas. Su
      // pantalla es la bandeja de tareas (lo suyo y lo libre de sus áreas);
      // "Pedidos" queda para Recepción.
      {
        title: "Tareas asignadas",
        url: TASKS_URL,
        icon: ListChecks,
      },
      {
        // Cada área lleva las existencias de su estante (hilos, tintas...).
        title: "Inventario",
        url: INVENTORY_URL,
        icon: Warehouse,
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
export function buildMenuItems(): NavGroup[] {
  return [
    {
      groupLabel: "Operación",
      items: [
        HOME_ITEM,
        {
          title: "Panel General",
          url: "/dashboard/admin",
          icon: LayoutDashboard,
          roles: ["admin", "superuser"],
        },
        {
          // Gestión de pedidos de punta a punta: Recepción (y admin).
          title: "Pedidos",
          url: "/dashboard/orders",
          icon: Package,
          roles: ["admin", "superuser", "recepcion"],
        },
        {
          // Quien gestiona Y además trabaja un área (ej. Recepción + Taller)
          // también tiene su bandeja.
          title: "Tareas asignadas",
          url: TASKS_URL,
          icon: ListChecks,
          roles: WORK_AREA_ROLES,
          strictRoles: true,
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
          // Catálogo de materiales/insumos.
          title: "Materiales",
          url: "/dashboard/materiales",
          icon: Boxes,
          roles: ["admin", "recepcion", "superuser"],
        },
        {
          title: "Proveedores",
          url: "/dashboard/proveedores",
          icon: Truck,
          roles: ["admin", "recepcion", "superuser"],
        },
        {
          // Existencias por departamento; cada área ve sólo la suya.
          title: "Inventario",
          url: INVENTORY_URL,
          icon: Warehouse,
          roles: ALL_ROLES,
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
  HOME_URL,
  "/dashboard/orders",
  TASKS_URL,
  "/dashboard/chat",
  "/dashboard/notificaciones",
  "/dashboard/admin/rendimiento",
  "/dashboard/hoja-materiales",
  "/dashboard/historial",
  "/dashboard/clientes",
  "/dashboard/materiales",
  "/dashboard/proveedores",
  INVENTORY_URL,
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
  if (item.strictRoles && item.roles) {
    return userRoles.some((r) => item.roles!.includes(r));
  }
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

/** Inicio de cada rol: admin al panel general; Recepción, Diseño y Producción a su tablero en vivo. */
export function homePathForRoles(roles: string[]): string {
  if (roles.includes("admin") || roles.includes("superuser")) return "/dashboard/admin";
  if (roles.includes("recepcion") || roles.some((r) => WORK_AREA_ROLES.includes(r))) return HOME_URL;
  return "/dashboard/orders";
}

/** Pantallas fuera del menú que igual necesitan nombre en breadcrumb/pestaña. */
const EXTRA_ROUTE_TITLES: Record<string, string> = {
  "/dashboard/configuracion": "Configuración",
};

export interface Breadcrumb {
  label: string;
  /** Sin href = no navegable (sección o la página actual). */
  href?: string;
}

/**
 * Migas de la ruta actual a partir del menú (misma fuente que sidebar, móvil y
 * paleta): sección › página › detalle. Ej. `/dashboard/orders/123` →
 * Operación › Pedidos › #123.
 */
export function buildBreadcrumbs(groups: NavGroup[], pathname: string | null): Breadcrumb[] {
  if (!pathname) return [];
  const extra = EXTRA_ROUTE_TITLES[pathname];
  if (extra) return [{ label: extra }];

  const entries = groups.flatMap((group) =>
    group.items.map((item) => ({ group: group.groupLabel, item }))
  );
  const activeUrl = findActiveNavUrl(entries.map((e) => e.item.url), pathname);
  const entry = entries.find((e) => e.item.url === activeUrl);
  if (!entry) return [];

  const crumbs: Breadcrumb[] = [{ label: entry.group }];
  const rest = pathname.slice(entry.item.url.length).split("/").filter(Boolean);
  if (rest.length === 0) {
    crumbs.push({ label: entry.item.title });
  } else {
    crumbs.push({ label: entry.item.title, href: entry.item.url });
    const last = rest[rest.length - 1];
    crumbs.push({ label: /^\d+$/.test(last) ? `#${last}` : decodeURIComponent(last) });
  }
  return crumbs;
}

/** Título para la pestaña del navegador: la última miga con contexto. */
export function pageTitleFromBreadcrumbs(crumbs: Breadcrumb[]): string | null {
  if (crumbs.length === 0) return null;
  const last = crumbs[crumbs.length - 1].label;
  if (crumbs.length >= 3) return `${crumbs[crumbs.length - 2].label} ${last}`;
  return last;
}
