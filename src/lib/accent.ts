/**
 * Color de acento de la app (Configuración > Apariencia).
 *
 * Se aplica seteando `data-accent` en <html>, que activa los overrides de
 * `--primary` (y derivados) definidos en globals.css para claro y oscuro.
 * Persistido en localStorage para que sobreviva recargas y se pueda aplicar
 * antes del primer paint (ver script inline en layout.tsx).
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

export function isValidAccent(value: string | null | undefined): boolean {
  return !!value && ACCENT_OPTIONS.some((a) => a.id === value);
}

/** Aplica el acento al documento (no-op en SSR). */
export function applyAccent(accent: string) {
  if (typeof document === "undefined") return;
  if (accent === DEFAULT_ACCENT) {
    document.documentElement.removeAttribute("data-accent");
  } else {
    document.documentElement.setAttribute("data-accent", accent);
  }
}

/** Script inline (string) para setear el acento guardado antes del primer paint. */
export const ACCENT_INIT_SCRIPT = `
(function() {
  try {
    var a = localStorage.getItem("${ACCENT_STORAGE_KEY}");
    if (a && a !== "${DEFAULT_ACCENT}") {
      document.documentElement.setAttribute("data-accent", a);
    }
  } catch (e) {}
})();
`;
