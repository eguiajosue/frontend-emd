import { createAvatar } from "@dicebear/core";
import * as thumbs from "@dicebear/thumbs";

/** Semilla del avatar de un usuario: la guardada, o su id si nunca sorteó uno. */
export function avatarSeedFor(
  user?: { id?: number | string | null; avatarSeed?: string | null } | null
): string | null {
  if (user?.avatarSeed) return user.avatarSeed;
  return user?.id != null ? String(user.id) : null;
}

// shortcut: caché sin tope, una entrada por semilla vista; basta con los usuarios de una empresa, acotarla si crece a miles.
const cache = new Map<string, string>();

/** SVG del avatar como data URI. Memoizado: las listas largas no lo regeneran en cada render. */
export function avatarDataUri(seed: string): string {
  let uri = cache.get(seed);
  if (!uri) {
    uri = createAvatar(thumbs, { seed }).toDataUri();
    cache.set(seed, uri);
  }
  return uri;
}
