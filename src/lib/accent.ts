/**
 * Color de acento de la app (Configuración > Apariencia).
 *
 * Dos formas de acento:
 *  - Preset (id de ACCENT_OPTIONS): se aplica seteando `data-accent` en <html>,
 *    que activa los overrides de `--primary` (y derivados) definidos en
 *    globals.css para claro y oscuro.
 *  - Custom (hex, ej. "#ff8800"): se aplica seteando las mismas variables
 *    directamente como estilo inline en <html> (convertidas a HSL, como las
 *    espera el resto del CSS), con un foreground blanco/negro calculado por
 *    luminancia para mantener el contraste.
 *
 * La fuente de verdad es el backend (`GET/PATCH /users/me/preferences`);
 * localStorage queda sólo como cache local para poder aplicar el acento antes
 * del primer paint (ver ACCENT_INIT_SCRIPT) y evitar parpadeo mientras carga
 * la preferencia real.
 */
export const ACCENT_STORAGE_KEY = "app-accent";

export interface AccentOption {
  id: string;
  label: string;
  /** Color de muestra (swatch) en modo claro, para el selector. */
  previewHsl: string;
}

export const ACCENT_OPTIONS: AccentOption[] = [
  { id: "pink", label: "Rosa (predeterminado)", previewHsl: "330 81% 46%" },
  { id: "blue", label: "Azul", previewHsl: "217 91% 46%" },
  { id: "green", label: "Verde", previewHsl: "142 71% 35%" },
  { id: "orange", label: "Naranja", previewHsl: "24 90% 45%" },
  { id: "purple", label: "Púrpura", previewHsl: "262 70% 50%" },
  { id: "teal", label: "Cian", previewHsl: "189 85% 32%" },
];

export const DEFAULT_ACCENT = "pink";

/** Variables CSS que un acento (preset o custom) puede llegar a redefinir. */
const ACCENT_CSS_VARS = [
  "--primary",
  "--primary-foreground",
  "--ring",
  "--sidebar-primary",
  "--sidebar-primary-foreground",
  "--sidebar-ring",
] as const;

export function isHexColor(value: string | null | undefined): value is string {
  return !!value && /^#[0-9a-f]{6}$/i.test(value);
}

export function isValidAccent(value: string | null | undefined): boolean {
  return !!value && (ACCENT_OPTIONS.some((a) => a.id === value) || isHexColor(value));
}

/** Convierte un hex (#rrggbb) a la tripleta "H S% L%" que usa el resto del CSS. */
export function hexToHslTriplet(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** Luminancia relativa (WCAG) de un hex, para elegir foreground blanco o negro. */
function relativeLuminance(hex: string): number {
  const toLinear = (channel: number) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const r = toLinear(parseInt(hex.slice(1, 3), 16));
  const g = toLinear(parseInt(hex.slice(3, 5), 16));
  const b = toLinear(parseInt(hex.slice(5, 7), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Foreground (HSL) legible sobre un fondo hex dado. */
export function getForegroundForHex(hex: string): string {
  return relativeLuminance(hex) > 0.5 ? "0 0% 9%" : "0 0% 100%";
}

/** Aplica el acento al documento (no-op en SSR). */
export function applyAccent(accent: string) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  if (isHexColor(accent)) {
    root.removeAttribute("data-accent");
    const hsl = hexToHslTriplet(accent);
    const fg = getForegroundForHex(accent);
    root.style.setProperty("--primary", hsl);
    root.style.setProperty("--primary-foreground", fg);
    root.style.setProperty("--ring", hsl);
    root.style.setProperty("--sidebar-primary", hsl);
    root.style.setProperty("--sidebar-primary-foreground", fg);
    root.style.setProperty("--sidebar-ring", hsl);
    return;
  }

  ACCENT_CSS_VARS.forEach((v) => root.style.removeProperty(v));
  if (accent === DEFAULT_ACCENT) {
    root.removeAttribute("data-accent");
  } else {
    root.setAttribute("data-accent", accent);
  }
}

/** Script inline (string) para setear el acento guardado antes del primer paint. */
export const ACCENT_INIT_SCRIPT = `
(function() {
  try {
    var a = localStorage.getItem("${ACCENT_STORAGE_KEY}");
    if (!a) return;
    if (/^#[0-9a-fA-F]{6}$/.test(a)) {
      var r = parseInt(a.slice(1,3),16)/255, g = parseInt(a.slice(3,5),16)/255, b = parseInt(a.slice(5,7),16)/255;
      var max = Math.max(r,g,b), min = Math.min(r,g,b), h = 0, s = 0, l = (max+min)/2;
      if (max !== min) {
        var d = max-min;
        s = l > 0.5 ? d/(2-max-min) : d/(max+min);
        if (max === r) h = (g-b)/d + (g<b?6:0);
        else if (max === g) h = (b-r)/d + 2;
        else h = (r-g)/d + 4;
        h /= 6;
      }
      var hsl = Math.round(h*360) + " " + Math.round(s*100) + "% " + Math.round(l*100) + "%";
      var toLinear = function(c){ c/=255; return c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); };
      var lum = 0.2126*toLinear(parseInt(a.slice(1,3),16)) + 0.7152*toLinear(parseInt(a.slice(3,5),16)) + 0.0722*toLinear(parseInt(a.slice(5,7),16));
      var fg = lum > 0.5 ? "0 0% 9%" : "0 0% 100%";
      var root = document.documentElement;
      root.style.setProperty("--primary", hsl);
      root.style.setProperty("--primary-foreground", fg);
      root.style.setProperty("--ring", hsl);
      root.style.setProperty("--sidebar-primary", hsl);
      root.style.setProperty("--sidebar-primary-foreground", fg);
      root.style.setProperty("--sidebar-ring", hsl);
    } else if (a !== "${DEFAULT_ACCENT}") {
      document.documentElement.setAttribute("data-accent", a);
    }
  } catch (e) {}
})();
`;
