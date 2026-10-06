"use client";

import { usePathname } from "next/navigation";
import { MAX_PRIMARY_TABS, TAB_PRIORITY_URLS, findActiveNavUrl } from "@/lib/navMenu";
import { applyNavPreferences, pickPrimaryTabUrls } from "@/lib/navPreferences";
import { useNavPreferences } from "@/hooks/useNavPreferences";
import { useVisibleNavGroups } from "@/hooks/useVisibleNavItems";

/**
 * Fuente única de lo que muestran las superficies de navegación (riel de
 * escritorio, barra de pestañas móvil y hoja "Más"): grupos visibles por rol,
 * preferencias del usuario aplicadas (favoritos, orden, ocultos), la pantalla
 * activa y los tabs principales del móvil.
 *
 * La paleta Ctrl+K y las migas NO pasan por aquí: usan la lista por rol sin
 * preferencias, así un ítem oculto sigue a mano desde el buscador.
 */
export function useNavLayout() {
  const pathname = usePathname();
  const roleVisibleGroups = useVisibleNavGroups();
  const nav = useNavPreferences();
  const { favorites, groups } = applyNavPreferences(roleVisibleGroups, nav.prefs);
  const roleVisibleUrls = roleVisibleGroups.flatMap((group) => group.items.map((item) => item.url));
  return {
    roleVisibleGroups,
    favorites,
    groups,
    // Con la lista por rol ANTES de preferencias (R2): si se oculta
    // "Rendimiento", su pantalla no marca "Panel General" por prefijo.
    activeUrl: findActiveNavUrl(roleVisibleUrls, pathname),
    primaryTabUrls: pickPrimaryTabUrls(roleVisibleUrls, nav.prefs, TAB_PRIORITY_URLS, MAX_PRIMARY_TABS),
    nav,
  };
}
