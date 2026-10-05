import { FLAG_CODES } from "./flagCodes";

/**
 * Banderas de la biblioteca de mockups (flag-icons, MIT; SVG locales en
 * `public/flags/4x3/`, sin red; ver scripts/sync-flags.mjs). México, Estados
 * Unidos y Canadá van fijas arriba; el resto en orden alfabético por su
 * nombre en español (`Intl.DisplayNames("es")`).
 */

export interface FlagEntry {
  /** Código ISO 3166-1 alfa-2 en minúsculas. */
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
  return `/flags/4x3/${code}.svg`;
}

let displayNames: Intl.DisplayNames | null | undefined;

/** Nombre del país en español ("mx" → "México"); el código si el navegador no sabe. */
export function countryNameEs(code: string): string {
  if (displayNames === undefined) {
    try {
      displayNames = new Intl.DisplayNames(["es-MX", "es"], { type: "region" });
    } catch {
      displayNames = null;
    }
  }
  try {
    return displayNames?.of(code.toUpperCase()) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

/** Minúsculas y sin acentos: "méx" encuentra "México". */
export function normalizeSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const collator = new Intl.Collator("es", { sensitivity: "base" });

function buildFlags(): FlagEntry[] {
  const names = new Map(FLAG_CODES.map((code) => [code, countryNameEs(code)]));
  const pinned = PINNED_FLAG_CODES.filter((c) => names.has(c));
  const rest = FLAG_CODES.filter((c) => !(pinned as readonly string[]).includes(c)).sort((a, b) =>
    collator.compare(names.get(a)!, names.get(b)!)
  );
  return [...pinned, ...rest].map((code) => ({ code, name: names.get(code)!, url: flagUrl(code) }));
}

let cache: FlagEntry[] | null = null;

/** Todas las banderas: MX, US, CA y luego A-Z (se arma la primera vez que se pide). */
export function getFlags(): readonly FlagEntry[] {
  cache ??= buildFlags();
  return cache;
}

/**
 * Filtra por nombre en español (o un alias), sin importar acentos ni
 * mayúsculas. Conserva el orden de `getFlags()` (las fijas siguen arriba) pero
 * deja primero los que empiezan con lo buscado.
 */
export function searchFlags(query: string, flags: readonly FlagEntry[] = getFlags()): FlagEntry[] {
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
