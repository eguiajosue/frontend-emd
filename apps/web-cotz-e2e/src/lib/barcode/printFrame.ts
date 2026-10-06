/**
 * Imprime un documento HTML desde un iframe oculto: no abre pestañas ni
 * ventanas emergentes (que el navegador puede bloquear) y el CSS de la app no
 * se mete en la etiqueta. El diálogo de impresión del navegador es el que
 * deja elegir la impresora térmica.
 *
 * El iframe queda en la página hasta la siguiente impresión (se reemplaza):
 * algunos navegadores cancelan la impresión si el documento desaparece
 * mientras el diálogo sigue abierto.
 */
export const PRINT_FRAME_ID = "emd-label-print-frame";

export function printHtmlDocument(html: string): Promise<void> {
  document.getElementById(PRINT_FRAME_ID)?.remove();

  const frame = document.createElement("iframe");
  frame.id = PRINT_FRAME_ID;
  frame.setAttribute("aria-hidden", "true");
  frame.setAttribute("tabindex", "-1");
  frame.title = "Impresión de etiquetas";
  // Fuera de pantalla pero con tamaño real: con display:none Chrome imprime en blanco.
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:80mm;height:35mm;border:0;opacity:0;pointer-events:none;";

  return new Promise<void>((resolve, reject) => {
    frame.onload = async () => {
      try {
        const win = frame.contentWindow;
        if (!win) throw new Error("No se pudo preparar la impresión.");
        await win.document.fonts?.ready?.catch(() => undefined);
        win.focus();
        win.print();
        resolve();
      } catch (error) {
        reject(error);
      }
    };
    frame.srcdoc = html;
    document.body.appendChild(frame);
  });
}
