"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { request } from "@/lib/api";
import { useAuthToken } from "@/hooks/useEntity";
import {
  PREFERENCES_ENDPOINT,
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

/** Espera antes de mandar el PATCH: arrastrar varias veces seguidas manda uno solo. */
export const NAV_SAVE_DEBOUNCE_MS = 400;

/**
 * Copia local de "barra expandida" sólo para el primer pintado, antes de que
 * lleguen las preferencias del backend (si no, la barra saltaría de angosta a
 * ancha al cargar). La fuente de verdad sigue siendo `navPreferences`.
 */
const EXPANDED_STORAGE_KEY = "emd:nav-expanded";

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

/*
 * Estado compartido entre todas las instancias del hook (barra, Configuración,
 * móvil): el último valor pendiente de mandar y un contador para descartar
 * respuestas de PATCH viejas que llegan después de un cambio más nuevo (si no,
 * la lista "rebotaría" a un orden anterior mientras se arrastra).
 */
let pending: { value: NavPreferences | null } | null = null;
let saveSeq = 0;

/**
 * Preferencias de la barra lateral del usuario con guardado optimista: cada
 * cambio se ve al instante (se escribe en la caché de `useUserPreferences`) y
 * se manda al backend con debounce. Si el PATCH falla, el toast lo da el
 * manejo global de mutaciones y se recargan las preferencias reales.
 */
export function useNavPreferences() {
  const { preferences } = useUserPreferences();
  const queryClient = useQueryClient();
  const token = useAuthToken();

  const raw = preferences?.navPreferences;
  const prefs = useMemo(() => normalizeNavPreferences(raw), [raw]);
  // Se lee tras montar (no en el estado inicial) para no desfasar la hidratación.
  const [storedExpanded, setStoredExpanded] = useState(false);
  useEffect(() => setStoredExpanded(readStoredExpanded()), []);
  const expanded = preferences ? prefs.expanded : storedExpanded;

  useEffect(() => {
    if (preferences) writeStoredExpanded(prefs.expanded);
  }, [preferences, prefs.expanded]);

  const mutation = useMutation({
    mutationFn: ({ value }: { value: NavPreferences | null; seq: number }) =>
      request<UserPreferences>(PREFERENCES_ENDPOINT, {
        method: "PATCH",
        token,
        body: { navPreferences: value },
      }),
    onSuccess: (data, { seq }) => {
      if (seq === saveSeq && !pending) {
        queryClient.setQueryData(PREFERENCES_QUERY_KEY, data);
      }
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: PREFERENCES_QUERY_KEY });
    },
  });
  const mutateRef = useRef(mutation.mutate);
  mutateRef.current = mutation.mutate;

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!pending) return;
    const { value } = pending;
    pending = null;
    saveSeq += 1;
    mutateRef.current({ value, seq: saveSeq });
  }, []);

  // Al desmontar (ej. salir de Configuración) no se pierde lo pendiente.
  useEffect(() => () => {
    if (timer.current) flush();
  }, [flush]);

  const current = useCallback(
    () =>
      normalizeNavPreferences(
        queryClient.getQueryData<UserPreferences>(PREFERENCES_QUERY_KEY)?.navPreferences
      ),
    [queryClient]
  );

  const save = useCallback(
    (next: NavPreferences | null) => {
      queryClient.setQueryData<UserPreferences>(PREFERENCES_QUERY_KEY, (old) =>
        old ? { ...old, navPreferences: next } : old
      );
      writeStoredExpanded(next?.expanded ?? false);
      pending = { value: next };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, NAV_SAVE_DEBOUNCE_MS);
    },
    [queryClient, flush]
  );

  const update = useCallback(
    (fn: (prefs: NavPreferences) => NavPreferences) => {
      const before = current();
      const next = fn(before);
      if (next !== before) save(next);
    },
    [current, save]
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
    setExpanded: useCallback(
      (value: boolean) => update((p) => setExpandedPure(p, value)),
      [update]
    ),
    reorderFavorites: useCallback(
      (urls: string[]) => update((p) => reorderFavoritesPure(p, urls)),
      [update]
    ),
    reorderGroup: useCallback(
      (groupLabel: string, urls: string[]) => update((p) => reorderGroupPure(p, groupLabel, urls)),
      [update]
    ),
    /** Vuelve al menú por defecto (`navPreferences: null`). */
    reset: useCallback(() => save(null), [save]),
  };
}

export type NavPreferencesApi = ReturnType<typeof useNavPreferences>;
