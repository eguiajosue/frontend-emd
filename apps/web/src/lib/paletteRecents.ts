/**
 * Últimos destinos elegidos en la paleta ⌘K, por navegador. Es una comodidad
 * (si el storage no está disponible, simplemente no hay "Recientes"), así que
 * todo acceso va en try/catch.
 */
const STORAGE_KEY = "emd:palette-recents:v1";
export const MAX_RECENTS = 5;

export interface PaletteRecent {
  /** Identidad estable para deduplicar: "page:/dashboard/orders", "order:12", "client:3". */
  id: string;
  kind: "page" | "order" | "client";
  label: string;
  url: string;
}

function isRecent(value: unknown): value is PaletteRecent {
  const v = value as PaletteRecent;
  return (
    !!v &&
    typeof v.id === "string" &&
    typeof v.label === "string" &&
    typeof v.url === "string" &&
    v.url.startsWith("/dashboard") &&
    (v.kind === "page" || v.kind === "order" || v.kind === "client")
  );
}

export function readRecents(): PaletteRecent[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isRecent).slice(0, MAX_RECENTS) : [];
  } catch {
    return [];
  }
}

export function pushRecent(entry: PaletteRecent): PaletteRecent[] {
  const next = [entry, ...readRecents().filter((r) => r.id !== entry.id)].slice(0, MAX_RECENTS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Sin storage: la navegación sigue, sólo no se recuerda.
  }
  return next;
}
