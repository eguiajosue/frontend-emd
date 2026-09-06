/**
 * Preferencia de idioma (Configuración > Idioma).
 *
 * Por ahora es sólo infraestructura: no se traduce la app todavía, únicamente
 * se guarda la preferencia para que un trabajo futuro de traducción tenga de
 * dónde leerla.
 */
export const LANGUAGE_STORAGE_KEY = "app-language";

export interface LanguageOption {
  id: string;
  label: string;
  available: boolean;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { id: "es", label: "Español", available: true },
  { id: "en", label: "English", available: false },
];

export const DEFAULT_LANGUAGE = "es";
