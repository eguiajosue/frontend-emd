import { normalizeHexColor } from "@/lib/mockups/studio";
import { MAX_MY_COLORS, type MockupColorsPreference } from "@/lib/mockups/types";

/**
 * "Mis colores" del estudio de mockups: favoritos (con estrella) y colores
 * propios de cada usuario. Lógica pura; el hook `useMockupColors` la persiste
 * en `PATCH /users/me/preferences { mockupColors }`.
 */

export const EMPTY_MOCKUP_COLORS: MockupColorsPreference = { favorites: [], custom: [] };

export const MY_COLORS_FULL_MESSAGE = `Ya tienes ${MAX_MY_COLORS} colores guardados. Quita alguno para agregar otro.`;

function cleanList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const hex = normalizeHexColor(item);
    if (!hex || seen.has(hex)) continue;
    seen.add(hex);
    out.push(hex);
    if (out.length >= MAX_MY_COLORS) break;
  }
  return out;
}

/** Lo que venga del backend (o null) → listas válidas, sin repetidos y con tope. */
export function normalizeMockupColors(value: unknown): MockupColorsPreference {
  if (!value || typeof value !== "object") return { favorites: [], custom: [] };
  const raw = value as Partial<Record<keyof MockupColorsPreference, unknown>>;
  return { favorites: cleanList(raw.favorites), custom: cleanList(raw.custom) };
}

export type MyColorsResult =
  | { ok: true; colors: MockupColorsPreference; color: string }
  | { ok: false; error: string };

/**
 * Agrega un color propio (al principio: lo último agregado queda a la mano).
 * Si ya estaba, no lo repite.
 */
export function addCustomColor(colors: MockupColorsPreference, input: string): MyColorsResult {
  const hex = normalizeHexColor(input);
  if (!hex) return { ok: false, error: "Escribe un color válido, por ejemplo #1F2A44." };
  if (colors.custom.includes(hex)) return { ok: true, colors, color: hex };
  if (colors.custom.length >= MAX_MY_COLORS) return { ok: false, error: MY_COLORS_FULL_MESSAGE };
  return { ok: true, colors: { ...colors, custom: [hex, ...colors.custom] }, color: hex };
}

/** Marca o desmarca un color como favorito (al marcarlo va al principio). */
export function toggleFavoriteColor(colors: MockupColorsPreference, input: string): MyColorsResult {
  const hex = normalizeHexColor(input);
  if (!hex) return { ok: false, error: "Color no válido." };
  if (colors.favorites.includes(hex)) {
    return { ok: true, colors: { ...colors, favorites: colors.favorites.filter((c) => c !== hex) }, color: hex };
  }
  if (colors.favorites.length >= MAX_MY_COLORS) return { ok: false, error: MY_COLORS_FULL_MESSAGE };
  return { ok: true, colors: { ...colors, favorites: [hex, ...colors.favorites] }, color: hex };
}

/** Quita un color de "Mis colores" (de propios y de favoritos). */
export function removeMyColor(colors: MockupColorsPreference, input: string): MockupColorsPreference {
  const hex = normalizeHexColor(input);
  if (!hex) return colors;
  return {
    favorites: colors.favorites.filter((c) => c !== hex),
    custom: colors.custom.filter((c) => c !== hex),
  };
}

export interface MyColorEntry {
  value: string;
  favorite: boolean;
}

/** Orden para mostrar: favoritos primero, después los propios (sin repetir). */
export function orderedMyColors(colors: MockupColorsPreference): MyColorEntry[] {
  const favorites = colors.favorites.map((value) => ({ value, favorite: true }));
  const rest = colors.custom.filter((c) => !colors.favorites.includes(c)).map((value) => ({ value, favorite: false }));
  return [...favorites, ...rest];
}
