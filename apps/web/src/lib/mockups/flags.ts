import { FLAG_NAMES_ES } from "./flagNames";

/**
 * Banderas de la biblioteca de mockups (flag-icons, MIT; SVG locales en
 * `public/flags/`, sin red). México, Estados Unidos y Canadá van fijas
 * arriba; el resto en orden alfabético por su nombre en español.
 */

export interface FlagEntry {
  /** Código en minúsculas de flag-icons (ISO 3166-1 alfa-2 o "gb-eng"…). */
  code: string;
  /** Nombre en español. */
  name: string;
  /** Ruta del SVG 4x3 servido desde `public/`. */
  url: string;
}

/** Siempre arriba y en este orden. */
export const PINNED_FLAG_CODES = ["mx", "us", "ca"] as const;

/** Otros nombres con los que se buscan algunos países. */
const ALIASES: Record<string, string[]> = {
  us: ["EUA", "EE. UU.", "USA", "Estados Unidos de América", "Gringo"],
  gb: ["Gran Bretaña", "UK"],
  nl: ["Holanda"],
  kr: ["Corea"],
  cz: ["República Checa"],
  ps: ["Palestina"],
  va: ["Vaticano"],
  cd: ["Congo"],
  cg: ["Congo"],
  ae: ["Emiratos"],
};

export function flagUrl(code: string): string {
  return `/flags/${code}.svg`;
}

/** Minúsculas y sin acentos: "méx" encuentra "México". */
export function normalizeSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const collator = new Intl.Collator("es", { sensitivity: "base" });

function buildFlags(): FlagEntry[] {
  const pinned = PINNED_FLAG_CODES.filter((c) => c in FLAG_NAMES_ES);
  const rest = Object.keys(FLAG_NAMES_ES)
    .filter((c) => !(pinned as readonly string[]).includes(c))
    .sort((a, b) => collator.compare(FLAG_NAMES_ES[a], FLAG_NAMES_ES[b]));
  return [...pinned, ...rest].map((code) => ({ code, name: FLAG_NAMES_ES[code], url: flagUrl(code) }));
}

/** Todas las banderas: MX, US, CA y luego A-Z. */
export const FLAGS: readonly FlagEntry[] = buildFlags();

/**
 * Filtra por nombre en español (o un alias), sin importar acentos ni
 * mayúsculas. Conserva el orden de `FLAGS` (las fijas siguen arriba) pero
 * deja primero los que empiezan con lo buscado.
 */
export function searchFlags(query: string, flags: readonly FlagEntry[] = FLAGS): FlagEntry[] {
  const q = normalizeSearch(query);
  if (!q) return [...flags];
  const starts: FlagEntry[] = [];
  const contains: FlagEntry[] = [];
  for (const flag of flags) {
    const names = [flag.name, ...(ALIASES[flag.code] ?? [])].map(normalizeSearch);
    if (names.some((n) => n.startsWith(q) || n.split(/[\s-]/).some((w) => w.startsWith(q)))) starts.push(flag);
    else if (names.some((n) => n.includes(q)) || flag.code === q) contains.push(flag);
  }
  return [...starts, ...contains];
}

/** Nombre del diseño que queda en la lista de capas. */
export function flagLayerName(flag: Pick<FlagEntry, "name">): string {
  return `Bandera de ${flag.name}`;
}
