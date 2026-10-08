/** Evento global para abrir la paleta desde un botón (ej. "Buscar" del header). */
export const OPEN_COMMAND_PALETTE_EVENT = "emd:open-command-palette";

export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE_EVENT));
}
