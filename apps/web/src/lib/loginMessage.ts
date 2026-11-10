import { SESSION_EXPIRED_MESSAGE } from "@emd/api-client";

/**
 * Avisos que `/login?message=` puede mostrar. El texto viaja en la URL, así que
 * cualquiera puede armar un enlace con el mensaje que quiera ("Tu cuenta fue
 * bloqueada, llama al ...") y mostrarlo dentro de la pantalla de acceso real:
 * sólo se pinta lo que la propia app genera al cerrar sesión (`logout`).
 */
const KNOWN_LOGIN_MESSAGES: readonly string[] = [SESSION_EXPIRED_MESSAGE];

export function knownLoginMessage(raw: string | null | undefined): string | null {
  return raw && KNOWN_LOGIN_MESSAGES.includes(raw) ? raw : null;
}
