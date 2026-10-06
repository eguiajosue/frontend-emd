import type { Client } from "@/types";

/** Nombre a mostrar de un cliente registrado (igual que el backend: `first_name last_name`). */
export function clientDisplayName(client: Pick<Client, "first_name" | "last_name">): string {
  return [client.first_name, client.last_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
}

/** Minúsculas, sin acentos ni espacios de más: para comparar nombres. */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Cliente registrado con EXACTAMENTE ese nombre (sin distinguir mayúsculas ni
 * acentos). Sólo coincidencia exacta y única: "TNL" no se liga a "TNL
 * Logística" por adivinar, y dos clientes con el mismo nombre tampoco.
 */
export function findClientByName<T extends Pick<Client, "id" | "first_name" | "last_name">>(
  clients: T[],
  name: string
): T | null {
  const target = normalizeText(name);
  if (!target) return null;
  const matches = clients.filter((c) => normalizeText(clientDisplayName(c)) === target);
  return matches.length === 1 ? matches[0] : null;
}

/** Búsqueda local: cada palabra tiene que aparecer en alguno de los textos. */
export function matchesSearch(texts: (string | null | undefined)[], query: string): boolean {
  const terms = normalizeText(query).split(" ").filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = normalizeText(texts.filter(Boolean).join(" "));
  return terms.every((term) => haystack.includes(term));
}
