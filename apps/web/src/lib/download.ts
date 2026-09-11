/**
 * Descarga de archivos al disco del usuario.
 *
 * Recepción necesita BAJAR la hoja de autorización (montaje) para mandársela
 * al cliente por fuera del sistema, así que no alcanza con abrirla en una
 * pestaña: hace falta un `<a download>` de verdad. Los archivos que ya vienen
 * como `data:` URL se linkean directo; los que se piden con Bearer llegan como
 * blob URL cacheada por React Query, y ésa NO se puede revocar (rompería la
 * vista previa que sigue en pantalla), así que se copia a una blob URL propia,
 * se dispara la descarga y se revoca esa copia.
 */
export async function downloadFromUrl(url: string, filename: string): Promise<void> {
  let href = url;
  let temporary = false;

  if (url.startsWith("blob:")) {
    const blob = await fetch(url).then((res) => res.blob());
    href = URL.createObjectURL(blob);
    temporary = true;
  }

  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  if (temporary) {
    // Revocar en el mismo tick cancelaría la descarga en Firefox.
    setTimeout(() => URL.revokeObjectURL(href), 10_000);
  }
}
