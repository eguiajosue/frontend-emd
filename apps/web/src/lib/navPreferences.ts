/**
 * Preferencias de la barra lateral por usuario (docs/plans/sidebar-y-mockups-v2.md):
 * favoritos arriba, orden propio dentro de cada grupo, ítems ocultos y barra
 * expandida (con títulos). Se guardan en `User.navPreferences` vía
 * `PATCH /users/me/preferences`; `null` = menú por defecto.
 *
 * Todo aquí es puro: recibe los grupos ya filtrados por rol (lo que el usuario
 * puede ver) y devuelve qué pintar. Los ids son la `url` de cada ítem, así que
 * un id que ya no existe o que el rol ya no puede ver simplemente se ignora,
 * y un ítem nuevo del menú aparece al final de su grupo.
 */

export interface NavPreferences {
  /** Urls fijadas arriba, en el orden del usuario. */
  favorites: string[];
  /**
   * Orden propio: una sola lista plana de urls. Cada grupo ordena sus ítems
   * por su posición aquí; así el orden sobrevive a renombrar grupos, a
   * cambiar de menú (operativo ↔ completo) y a ítems que cambian de grupo.
   */
  order: string[];
  /** Urls que no se muestran en la barra (siguen accesibles por url y Ctrl+K). */
  hidden: string[];
  /** Barra expandida: muestra los títulos junto a los íconos. */
  expanded: boolean;
}

export const DEFAULT_NAV_PREFERENCES: NavPreferences = {
  favorites: [],
  order: [],
  hidden: [],
  expanded: false,
};

/** Mínimo que necesita un ítem para ordenarse: su url. */
export interface NavEntry {
  url: string;
}

export interface NavGroupOf<T extends NavEntry> {
  groupLabel: string;
  items: T[];
}

/** Tope por lista; el backend rechaza más. */
export const MAX_NAV_IDS = 50;

function uniqueStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const v of value) {
    if (typeof v === "string" && v.length > 0 && !seen.has(v)) seen.add(v);
    if (seen.size >= MAX_NAV_IDS) break;
  }
  return [...seen];
}

/**
 * Lee lo que venga del backend (o de una versión vieja) sin confiar en su
 * forma: cualquier campo inválido cae a su valor por defecto.
 */
export function normalizeNavPreferences(raw: unknown): NavPreferences {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_NAV_PREFERENCES };
  }
  const r = raw as Record<string, unknown>;
  // Siempre exactamente estas cuatro llaves: es lo que acepta el backend.
  return {
    favorites: uniqueStrings(r.favorites),
    order: uniqueStrings(r.order),
    hidden: uniqueStrings(r.hidden),
    expanded: r.expanded === true,
  };
}

/**
 * Todos los ítems del grupo (incluidos favoritos y ocultos) en el orden del
 * usuario: primero los que están en `prefs.order`, por su posición ahí;
 * después los que no (nuevos o nunca movidos), en el orden por defecto.
 */
export function orderGroupItems<T extends NavEntry>(
  group: NavGroupOf<T>,
  prefs: NavPreferences
): T[] {
  if (prefs.order.length === 0) return group.items;
  const index = new Map(prefs.order.map((url, i) => [url, i]));
  const saved = group.items.filter((item) => index.has(item.url));
  if (saved.length === 0) return group.items;
  saved.sort((a, b) => index.get(a.url)! - index.get(b.url)!);
  return [...saved, ...group.items.filter((item) => !index.has(item.url))];
}

/**
 * Favoritos visibles en el orden del usuario (sin ocultos ni ids
 * desconocidos/ya no permitidos).
 */
export function resolveFavorites<T extends NavEntry>(
  groups: NavGroupOf<T>[],
  prefs: NavPreferences
): T[] {
  const byUrl = new Map<string, T>();
  for (const group of groups) {
    for (const item of group.items) if (!byUrl.has(item.url)) byUrl.set(item.url, item);
  }
  const hidden = new Set(prefs.hidden);
  const result: T[] = [];
  const seen = new Set<string>();
  for (const url of prefs.favorites) {
    const item = byUrl.get(url);
    if (item && !hidden.has(url) && !seen.has(url)) {
      result.push(item);
      seen.add(url);
    }
  }
  return result;
}

/**
 * Lo que pinta la barra: la sección Favoritos y los grupos sin los favoritos
 * (no se duplican), sin los ocultos y en el orden del usuario. Un grupo que se
 * queda sin ítems no aparece.
 */
export function applyNavPreferences<T extends NavEntry>(
  groups: NavGroupOf<T>[],
  prefs: NavPreferences
): { favorites: T[]; groups: NavGroupOf<T>[] } {
  const favorites = resolveFavorites(groups, prefs);
  const favoriteUrls = new Set(favorites.map((item) => item.url));
  const hidden = new Set(prefs.hidden);
  const shown = new Set<string>(favoriteUrls);
  const result: NavGroupOf<T>[] = [];
  for (const group of groups) {
    const items = orderGroupItems(group, prefs).filter((item) => {
      if (hidden.has(item.url) || shown.has(item.url)) return false;
      shown.add(item.url);
      return true;
    });
    if (items.length > 0) result.push({ ...group, items });
  }
  return { favorites, groups: result };
}

/* ---------- Cambios (inmutables) ---------- */

export function isFavorite(prefs: NavPreferences, url: string): boolean {
  return prefs.favorites.includes(url);
}

export function isHidden(prefs: NavPreferences, url: string): boolean {
  return prefs.hidden.includes(url);
}

/** Fija o quita de favoritos. Fijar un ítem oculto lo vuelve a mostrar. */
export function toggleFavorite(prefs: NavPreferences, url: string): NavPreferences {
  if (prefs.favorites.includes(url)) {
    return { ...prefs, favorites: prefs.favorites.filter((u) => u !== url) };
  }
  if (prefs.favorites.length >= MAX_NAV_IDS) return prefs;
  return {
    ...prefs,
    favorites: [...prefs.favorites, url],
    hidden: prefs.hidden.filter((u) => u !== url),
  };
}

/** Oculta o muestra. Ocultar un favorito también lo quita de favoritos. */
export function setHidden(prefs: NavPreferences, url: string, hidden: boolean): NavPreferences {
  if (hidden) {
    if (prefs.hidden.includes(url) && !prefs.favorites.includes(url)) return prefs;
    if (!prefs.hidden.includes(url) && prefs.hidden.length >= MAX_NAV_IDS) return prefs;
    return {
      ...prefs,
      hidden: prefs.hidden.includes(url) ? prefs.hidden : [...prefs.hidden, url],
      favorites: prefs.favorites.filter((u) => u !== url),
    };
  }
  if (!prefs.hidden.includes(url)) return prefs;
  return { ...prefs, hidden: prefs.hidden.filter((u) => u !== url) };
}

/**
 * Nuevo orden de favoritos. Recibe sólo los visibles (lo que el usuario ve
 * en la lista); los favoritos guardados que hoy no se pueden ver se
 * conservan al final para no perderlos si el rol vuelve a tenerlos.
 */
export function reorderFavorites(prefs: NavPreferences, urls: string[]): NavPreferences {
  const next = uniqueStrings(urls);
  const rest = prefs.favorites.filter((u) => !next.includes(u));
  return { ...prefs, favorites: [...next, ...rest].slice(0, MAX_NAV_IDS) };
}

/**
 * Nuevo orden de un grupo: `urls` son todas las del grupo (incluidos
 * favoritos y ocultos) en su nuevo orden. Se quitan de la lista plana y se
 * agregan al final; el orden relativo de los demás grupos no cambia.
 */
export function reorderGroup(prefs: NavPreferences, urls: string[]): NavPreferences {
  const group = uniqueStrings(urls);
  const others = prefs.order.filter((u) => !group.includes(u));
  // Si no cabe todo, se sacrifican primero las urls más viejas de otros grupos.
  const room = Math.max(0, MAX_NAV_IDS - group.length);
  return { ...prefs, order: [...others.slice(Math.max(0, others.length - room)), ...group] };
}

export function setExpanded(prefs: NavPreferences, expanded: boolean): NavPreferences {
  return prefs.expanded === expanded ? prefs : { ...prefs, expanded };
}

/* ---------- Barra de pestañas móvil ---------- */

/**
 * Urls de los tabs principales de la barra móvil: primero los favoritos (en
 * su orden), luego la prioridad por defecto, sin ocultos, hasta `max`. Todo
 * lo que no entra (incluidos los ocultos) queda en "Más".
 */
export function pickPrimaryTabUrls(
  visibleUrls: string[],
  prefs: NavPreferences,
  priority: string[],
  max: number
): string[] {
  const visible = new Set(visibleUrls);
  const hidden = new Set(prefs.hidden);
  const picked: string[] = [];
  for (const url of [...prefs.favorites, ...priority]) {
    if (picked.length >= max) break;
    if (visible.has(url) && !hidden.has(url) && !picked.includes(url)) picked.push(url);
  }
  return picked;
}
