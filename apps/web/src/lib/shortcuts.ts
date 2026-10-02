/** Evento global para abrir la lista de atajos (tecla `?` o acción de la paleta). */
export const OPEN_SHORTCUTS_EVENT = "emd:open-shortcuts";

export function openShortcutsHelp() {
  window.dispatchEvent(new Event(OPEN_SHORTCUTS_EVENT));
}

/** Tiempo para la segunda tecla de una secuencia "g + letra". */
export const SEQUENCE_TIMEOUT_MS = 1200;

/**
 * Atajos "ir a" (estilo Gmail/Linear: `g` y después la letra). Las letras son
 * la inicial de la pantalla en castellano; "i" es Inicio y cambia de destino
 * según el rol (ver `homePathForRoles`).
 */
const GO_KEYS: { key: string; url: string | "home" }[] = [
  { key: "i", url: "home" },
  { key: "p", url: "/dashboard/orders" },
  { key: "c", url: "/dashboard/clientes" },
  { key: "a", url: "/dashboard/calendario" },
  { key: "h", url: "/dashboard/historial" },
  { key: "m", url: "/dashboard/hoja-materiales" },
  { key: "n", url: "/dashboard/notificaciones" },
];

export interface GoShortcut {
  key: string;
  url: string;
  label: string;
}

/**
 * Atajos "ir a" que aplican al rol: sólo pantallas que su menú ya muestra,
 * con el mismo nombre que en el menú (ej. "Tareas asignadas" para operarios).
 */
export function resolveGoShortcuts(
  navItems: { title: string; url: string }[],
  homeUrl: string
): GoShortcut[] {
  const titles = new Map(navItems.map((item) => [item.url, item.title]));
  const result: GoShortcut[] = [];
  for (const { key, url } of GO_KEYS) {
    if (url === "home") {
      result.push({ key, url: homeUrl, label: "Inicio" });
      continue;
    }
    const title = titles.get(url);
    if (title) result.push({ key, url, label: title });
  }
  return result;
}

/** Mientras se escribe, ninguna letra es un atajo. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.tagName !== "string") return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable === true;
}
