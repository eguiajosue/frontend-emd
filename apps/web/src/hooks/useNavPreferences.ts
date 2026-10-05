"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  PREFERENCES_QUERY_KEY,
  useUserPreferences,
  type UserPreferences,
} from "@/hooks/useUserPreferences";
import {
  normalizeNavPreferences,
  reorderFavorites as reorderFavoritesPure,
  reorderGroup as reorderGroupPure,
  setExpanded as setExpandedPure,
  setHidden as setHiddenPure,
  toggleFavorite as toggleFavoritePure,
  type NavPreferences,
} from "@/lib/navPreferences";

/**
 * Copia local de "barra expandida" sólo para el primer pintado, antes de que
 * lleguen las preferencias del backend (si no, la barra saltaría de angosta a
 * ancha en cada carga). Al llegar, manda el valor del servidor (R13).
 */
export const EXPANDED_STORAGE_KEY = "emd:nav-expanded";

function readStoredExpanded(): boolean {
  try {
    return localStorage.getItem(EXPANDED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeStoredExpanded(expanded: boolean) {
  try {
    localStorage.setItem(EXPANDED_STORAGE_KEY, expanded ? "1" : "0");
  } catch {
    // Sin almacenamiento: sólo se pierde el primer pintado.
  }
}

/**
 * Preferencias de la barra lateral del usuario (`navPreferences`). Cada cambio
 * se calcula sobre el valor más reciente de la caché y se guarda con
 * `updatePreferences`, que es optimista y serializa los PATCH: se ve al
 * instante y los clics rápidos no llegan en desorden. Siempre se manda el
 * objeto completo (las cuatro llaves) o `null` para restablecer.
 */
export function useNavPreferences() {
  const { preferences, updatePreferences } = useUserPreferences();
  const queryClient = useQueryClient();

  const raw = preferences?.navPreferences;
  const prefs = useMemo(() => normalizeNavPreferences(raw), [raw]);
  // Se lee tras montar (no en el estado inicial) para no desfasar la hidratación.
  const [storedExpanded, setStoredExpanded] = useState(false);
  useEffect(() => setStoredExpanded(readStoredExpanded()), []);
  const expanded = preferences ? prefs.expanded : storedExpanded;

  useEffect(() => {
    if (preferences) writeStoredExpanded(prefs.expanded);
  }, [preferences, prefs.expanded]);

  const save = useCallback(
    (next: NavPreferences | null) => {
      writeStoredExpanded(next?.expanded ?? false);
      return updatePreferences({ navPreferences: next });
    },
    [updatePreferences]
  );

  const update = useCallback(
    (fn: (prefs: NavPreferences) => NavPreferences) => {
      const before = normalizeNavPreferences(
        queryClient.getQueryData<UserPreferences>(PREFERENCES_QUERY_KEY)?.navPreferences
      );
      const next = fn(before);
      if (next !== before) void save(next);
    },
    [queryClient, save]
  );

  return {
    prefs,
    expanded,
    /** El usuario cambió algo (hay preferencias guardadas). */
    isCustomized: raw != null,
    isReady: !!preferences,
    toggleFavorite: useCallback((url: string) => update((p) => toggleFavoritePure(p, url)), [update]),
    setHidden: useCallback(
      (url: string, hidden: boolean) => update((p) => setHiddenPure(p, url, hidden)),
      [update]
    ),
    setExpanded: useCallback((value: boolean) => update((p) => setExpandedPure(p, value)), [update]),
    reorderFavorites: useCallback(
      (urls: string[]) => update((p) => reorderFavoritesPure(p, urls)),
      [update]
    ),
    /** `urls`: todas las del grupo, en su nuevo orden. */
    reorderGroup: useCallback((urls: string[]) => update((p) => reorderGroupPure(p, urls)), [update]),
    /** Vuelve al menú por defecto (`navPreferences: null`). */
    reset: useCallback(() => void save(null), [save]),
  };
}

export type NavPreferencesApi = ReturnType<typeof useNavPreferences>;
