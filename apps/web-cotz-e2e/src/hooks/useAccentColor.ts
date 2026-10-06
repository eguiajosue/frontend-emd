"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ACCENT_STORAGE_KEY,
  DEFAULT_ACCENT,
  applyAccent,
  isValidAccent,
} from "@/lib/accent";

/** Lee/persiste/aplica el color de acento elegido en Configuración > Apariencia. */
export function useAccentColor() {
  const [accent, setAccentState] = useState<string>(DEFAULT_ACCENT);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(ACCENT_STORAGE_KEY);
      if (isValidAccent(stored)) setAccentState(stored as string);
    } catch {
      // Sin acceso a localStorage: se queda en el acento por defecto.
    }
  }, []);

  const setAccent = useCallback((next: string) => {
    setAccentState(next);
    applyAccent(next);
    try {
      localStorage.setItem(ACCENT_STORAGE_KEY, next);
    } catch {
      // No pasa nada si no se puede persistir.
    }
  }, []);

  return { accent, setAccent, mounted };
}
