"use client";

import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  PREFERENCES_QUERY_KEY,
  useUserPreferences,
  type UserPreferences,
} from "@/hooks/useUserPreferences";
import {
  addCustomColor,
  normalizeMockupColors,
  orderedMyColors,
  removeMyColor,
  toggleFavoriteColor,
  type MyColorEntry,
  type MyColorsResult,
} from "@/lib/mockups/myColors";
import type { MockupColorsPreference } from "@/lib/mockups/types";

/**
 * "Mis colores" del usuario en el estudio de mockups. Es una preferencia por
 * usuario (lo que agrega uno no le aparece a otro), guardada con
 * `PATCH /users/me/preferences { mockupColors }`.
 *
 * Los cambios son optimistas: se ven al instante en la caché de preferencias
 * y, si el guardado falla, vuelven a como estaban (el toast de error lo pone
 * el manejo global de mutaciones).
 */
export function useMockupColors() {
  const queryClient = useQueryClient();
  const { preferences, updatePreferences } = useUserPreferences();

  const colors = useMemo(() => normalizeMockupColors(preferences?.mockupColors), [preferences?.mockupColors]);
  const entries: MyColorEntry[] = useMemo(() => orderedMyColors(colors), [colors]);

  const persist = useCallback(
    async (change: (current: MockupColorsPreference) => MyColorsResult | MockupColorsPreference) => {
      // Se parte de la caché (no del render): dos cambios seguidos no se pisan.
      const cached = queryClient.getQueryData<UserPreferences>(PREFERENCES_QUERY_KEY);
      const current = normalizeMockupColors(cached?.mockupColors);
      const result = change(current);
      let next: MockupColorsPreference;
      if ("ok" in result) {
        if (!result.ok) {
          toast.error(result.error);
          return false;
        }
        next = result.colors;
      } else {
        next = result;
      }
      if (next === current) return true;

      queryClient.setQueryData<UserPreferences>(PREFERENCES_QUERY_KEY, (prev) =>
        prev ? { ...prev, mockupColors: next } : ({ mockupColors: next } as UserPreferences)
      );
      const saved = await updatePreferences({ mockupColors: next });
      if (!saved) {
        // Falló: se regresa a lo que había (si nadie lo cambió mientras tanto).
        queryClient.setQueryData<UserPreferences>(PREFERENCES_QUERY_KEY, (prev) =>
          prev && prev.mockupColors === next ? { ...prev, mockupColors: cached?.mockupColors ?? null } : prev
        );
        return false;
      }
      return true;
    },
    [queryClient, updatePreferences]
  );

  return {
    colors,
    /** Favoritos primero, después los propios. */
    entries,
    addColor: (hex: string) => persist((c) => addCustomColor(c, hex)),
    toggleFavorite: (hex: string) => persist((c) => toggleFavoriteColor(c, hex)),
    removeColor: (hex: string) => persist((c) => removeMyColor(c, hex)),
  };
}

export type MockupColorsApi = ReturnType<typeof useMockupColors>;
