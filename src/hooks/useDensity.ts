"use client";

import { useCallback, useEffect, useState } from "react";

export type Density = "comfortable" | "compact";

export const DENSITY_STORAGE_KEY = "app-density";
export const DEFAULT_DENSITY: Density = "comfortable";

function isDensity(value: string | null): value is Density {
  return value === "comfortable" || value === "compact";
}

/** Aplica la densidad al documento (no-op en SSR) vía `data-density` en <html>. */
export function applyDensity(density: Density) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-density", density);
}

/**
 * Lee/persiste/aplica la densidad de listas/cards (Configuración > "Vista
 * compacta"). Mismo patrón que useAccentColor/useGlassIntensity: localStorage
 * como cache local + backend (`glassIntensity`... acá `density`) como fuente
 * de verdad, sincronizado desde providers.tsx.
 */
export function useDensity() {
  const [density, setDensityState] = useState<Density>(DEFAULT_DENSITY);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(DENSITY_STORAGE_KEY);
      if (isDensity(stored)) {
        setDensityState(stored);
        applyDensity(stored);
      }
    } catch {
      // Sin acceso a localStorage: se queda en "comfortable".
    }
  }, []);

  const setDensity = useCallback((next: Density) => {
    setDensityState(next);
    applyDensity(next);
    try {
      localStorage.setItem(DENSITY_STORAGE_KEY, next);
    } catch {
      // No pasa nada si no se puede persistir.
    }
  }, []);

  return { density, setDensity, mounted };
}
