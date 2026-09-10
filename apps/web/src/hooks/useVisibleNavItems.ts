"use client";

import { useSession } from "next-auth/react";
import type { LucideIcon } from "lucide-react";
import { isOperationalOnly } from "@/lib/roleTaskMapping";
import { OPERATIONAL_MENU, buildMenuItems, isNavItemVisible } from "@/lib/navMenu";
import { useChatUnreadCount } from "@/hooks/useChat";
import { useUnreadNotificationsCount } from "@/hooks/useNotifications";

export interface VisibleNavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  unreadCount: number;
}

/**
 * Lista plana y ya filtrada por rol de los ítems de navegación visibles para
 * el usuario actual, en el mismo orden que `app-sidebar.tsx` los agrupa.
 * Fuente única compartida entre el rail de escritorio (`app-sidebar.tsx`) y
 * la barra flotante móvil (`MobileTabBar.tsx`) para que nunca diverjan sobre
 * qué puede ver cada rol.
 */
export function useVisibleNavItems(): VisibleNavItem[] {
  const { data: session } = useSession();
  const userRoles = session?.user?.roles || [];
  const operationalOnly = isOperationalOnly(userRoles);
  const chatUnread = useChatUnreadCount();
  const { count: notificationsUnread } = useUnreadNotificationsCount();

  const groups = operationalOnly ? OPERATIONAL_MENU : buildMenuItems(userRoles);

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
      items.push({ title: item.title, url: item.url, icon: item.icon, unreadCount });
    }
  }
  return items;
}
