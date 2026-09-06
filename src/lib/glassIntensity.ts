/**
 * Intensidad del efecto Liquid Glass (Configuración > Apariencia).
 *
 * Escala las variables `--glass-opacity-heavy/medium/light` definidas en
 * globals.css (por tema, claro/oscuro) proporcionalmente a un valor 0-100:
 *  - 100% = valores originales de globals.css (comportamiento actual, default).
 *  - 0%   = mínimo legible (nunca opacidad 0 total, para no romper contraste).
 *
 * Igual que el acento, se persiste en localStorage como cache local para
 * aplicar antes del primer paint (evitar parpadeo) y en el backend
 * (`PATCH /users/me/preferences`, campo `glassIntensity`) como fuente de
 * verdad por usuario.
 */
export const GLASS_INTENSITY_STORAGE_KEY = "app-glass-intensity";

export const DEFAULT_GLASS_INTENSITY = 100;

/** Opacidad mínima a la que se permite bajar cada variable (evita "romper" legibilidad). */
const MIN_OPACITY = 0.15;

/** Valores base (100%) de --glass-opacity-* definidos en globals.css, por tema. */
const BASE_OPACITY = {
  light: { heavy: 0.92, medium: 0.85, light: 0.7 },
  dark: { heavy: 0.82, medium: 0.62, light: 0.45 },
} as const;

function scale(base: number, intensityPct: number): number {
  const t = Math.min(100, Math.max(0, intensityPct)) / 100;
  const value = MIN_OPACITY + (base - MIN_OPACITY) * t;
  return Math.round(value * 1000) / 1000;
}

/**
 * Aplica la intensidad al documento (no-op en SSR). Setea las tres variables
 * para ambos temas vía estilo inline en <html>, que gana precedencia sobre
 * los valores de `:root`/`.dark` de globals.css sin tener que duplicar CSS.
 */
export function applyGlassIntensity(intensityPct: number) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const isDark = root.classList.contains("dark");
  const base = isDark ? BASE_OPACITY.dark : BASE_OPACITY.light;

  root.style.setProperty("--glass-opacity-heavy", String(scale(base.heavy, intensityPct)));
  root.style.setProperty("--glass-opacity-medium", String(scale(base.medium, intensityPct)));
  root.style.setProperty("--glass-opacity-light", String(scale(base.light, intensityPct)));
}

export function clampGlassIntensity(value: number | null | undefined): number {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return DEFAULT_GLASS_INTENSITY;
  }
  return Math.min(100, Math.max(0, Math.round(value)));
}
