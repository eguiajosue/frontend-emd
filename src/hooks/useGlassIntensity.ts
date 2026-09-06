"use client";

import { useCallback, useEffect, useState } from "react";
import { useTheme } from "next-themes";
import {
  DEFAULT_GLASS_INTENSITY,
  GLASS_INTENSITY_STORAGE_KEY,
  applyGlassIntensity,
  clampGlassIntensity,
} from "@/lib/glassIntensity";

/** Lee/persiste/aplica la intensidad del Liquid Glass elegida en Configuración > Apariencia. */
export function useGlassIntensity() {
  const [intensity, setIntensityState] = useState<number>(DEFAULT_GLASS_INTENSITY);
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(GLASS_INTENSITY_STORAGE_KEY);
      if (stored !== null) setIntensityState(clampGlassIntensity(Number(stored)));
    } catch {
      // Sin acceso a localStorage: se queda en el valor por defecto.
    }
  }, []);

  // Re-aplica al cambiar de tema (claro/oscuro tienen bases de opacidad distintas).
  useEffect(() => {
    if (!mounted) return;
    applyGlassIntensity(intensity);
  }, [mounted, intensity, resolvedTheme]);

  const setIntensity = useCallback((next: number) => {
    const clamped = clampGlassIntensity(next);
    setIntensityState(clamped);
    applyGlassIntensity(clamped);
    try {
      localStorage.setItem(GLASS_INTENSITY_STORAGE_KEY, String(clamped));
    } catch {
      // No pasa nada si no se puede persistir.
    }
  }, []);

  return { intensity, setIntensity, mounted };
}
