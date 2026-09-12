"use client";

import { useCallback, useEffect, useState } from "react";
import { formatTimeOfDay, type TimeFormatPreference } from "@/lib/format";

export const TIME_FORMAT_STORAGE_KEY = "app-time-format";
export const DEFAULT_TIME_FORMAT: TimeFormatPreference = "24h";

function isTimeFormat(value: string | null): value is TimeFormatPreference {
  return value === "24h" || value === "12h";
}

/**
 * Lee/persiste el formato de hora (Configuración > Formato de hora). Mismo
 * patrón que useDensity/useAccentColor: localStorage como cache local (sin
 * parpadeo mientras carga la sesión) + backend (`timeFormatPreference`) como
 * fuente de verdad, sincronizado desde providers.tsx.
 */
export function useTimeFormat() {
  const [timeFormat, setTimeFormatState] = useState<TimeFormatPreference>(DEFAULT_TIME_FORMAT);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(TIME_FORMAT_STORAGE_KEY);
      if (isTimeFormat(stored)) setTimeFormatState(stored);
    } catch {
      // Sin acceso a localStorage: se queda en "24h".
    }
  }, []);

  const setTimeFormat = useCallback((next: TimeFormatPreference) => {
    setTimeFormatState(next);
    try {
      localStorage.setItem(TIME_FORMAT_STORAGE_KEY, next);
    } catch {
      // No pasa nada si no se puede persistir.
    }
  }, []);

  const formatTime = useCallback((date: Date) => formatTimeOfDay(date, timeFormat), [timeFormat]);

  return { timeFormat, setTimeFormat, mounted, formatTime };
}
