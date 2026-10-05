"use client";

import { useSession } from "next-auth/react";
import type { LucideIcon } from "lucide-react";
import { isOperationalOnly } from "@/lib/roleTaskMapping";
import { OPERATIONAL_MENU, buildMenuItems, isNavItemVisible, type NavGroup } from "@/lib/navMenu";
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

/** Grupos del menú (sin filtrar por rol) del usuario actual. */
export function useNavGroups() {
  const { data: session } = useSession();
  const userRoles = session?.user?.roles || [];
  return isOperationalOnly(userRoles) ? OPERATIONAL_MENU : buildMenuItems();
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
  const { data: session } = useSession();
  const userRoles = session?.user?.roles || [];
  const operationalOnly = isOperationalOnly(userRoles);
  const chatUnread = useChatUnreadCount();
  const { count: notificationsUnread } = useUnreadNotificationsCount();

  const groups = operationalOnly ? OPERATIONAL_MENU : buildMenuItems();

  const items: VisibleNavItem[] = [];
  for (const group of groups) {
    for (const item of group.items) {
      if (!isNavItemVisible(item, userRoles, operationalOnly)) continue;
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
  const { data: session } = useSession();
  const userRoles = session?.user?.roles || [];
  const operationalOnly = isOperationalOnly(userRoles);
  return (operationalOnly ? OPERATIONAL_MENU : buildMenuItems())
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => isNavItemVisible(item, userRoles, operationalOnly)),
    }))
    .filter((group) => group.items.length > 0);
}
