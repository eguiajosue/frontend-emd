"use client";

import { useSession } from "next-auth/react";
import type { LucideIcon } from "lucide-react";
import { isOperationalOnly } from "@/lib/roleTaskMapping";
import { isBranchOnly } from "@/lib/roles";
import type { SessionAccess } from "@emd/business/src/areas";
import { BRANCH_MENU, OPERATIONAL_MENU, buildMenuItems, isNavItemVisible, type NavGroup } from "@/lib/navMenu";
import { useChatUnreadCount } from "@/hooks/useChat";
import { useUnreadNotificationsCount } from "@/hooks/useNotifications";

export interface VisibleNavItem {
  title: string;
  /** Sección del menú a la que pertenece (ej. "Operación"). */
  group: string;
  url: string;
  icon: LucideIcon;
  unreadCount: number;
}

/** Roles y áreas de la sesión (vacíos mientras carga). */
function sessionAccess(session: ReturnType<typeof useSession>["data"]): SessionAccess {
  return { roles: session?.user?.roles ?? [], areas: session?.user?.areas ?? [] };
}

/** Grupos del menú (sin filtrar por rol) del usuario actual. */
export function useNavGroups() {
  const { data: session } = useSession();
  const access = sessionAccess(session);
  if (isBranchOnly(access)) return BRANCH_MENU;
  return isOperationalOnly(access) ? OPERATIONAL_MENU : buildMenuItems();
}

/**
 * Lista plana y ya filtrada por rol de los ítems de navegación visibles para
 * el usuario actual, en el mismo orden que `app-sidebar.tsx` los agrupa.
 * Fuente única compartida entre el rail de escritorio (`app-sidebar.tsx`) y
 * la barra flotante móvil (`MobileTabBar.tsx`) y la paleta ⌘K (`CommandPalette.tsx`)
 * para que nunca diverjan sobre
 * qué puede ver cada rol.
 */
export function useVisibleNavItems(): VisibleNavItem[] {
  const groups = useVisibleNavGroups();
  const chatUnread = useChatUnreadCount();
  const { count: notificationsUnread } = useUnreadNotificationsCount();

  const items: VisibleNavItem[] = [];
  for (const group of groups) {
    for (const item of group.items) {
      const unreadCount =
        item.url === "/dashboard/chat"
          ? chatUnread
          : item.url === "/dashboard/notificaciones"
          ? notificationsUnread
          : 0;
      items.push({
        title: item.title,
        group: group.groupLabel,
        url: item.url,
        icon: item.icon,
        unreadCount,
      });
    }
  }
  return items;
}

/**
 * Grupos del menú ya filtrados por rol (sin grupos vacíos): la base sobre la
 * que se aplican las preferencias de la barra (`lib/navPreferences.ts`).
 */
export function useVisibleNavGroups(): NavGroup[] {
  const { data: session, status } = useSession();
  const access = sessionAccess(session);
  // Mientras la sesión carga no se sabe el rol: sin ítems en vez de pintar el
  // menú completo y cambiarlo (la cuenta de sucursal veía parpadear opciones
  // que no puede abrir, y un clic podía perderse al re-renderizar la lista).
  if (status === "loading") return [];
  const branchOnly = isBranchOnly(access);
  const operationalOnly = branchOnly || isOperationalOnly(access);
  return (branchOnly ? BRANCH_MENU : operationalOnly ? OPERATIONAL_MENU : buildMenuItems())
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => isNavItemVisible(item, access, operationalOnly)),
    }))
    .filter((group) => group.items.length > 0);
}
