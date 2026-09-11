/**
 * Descarga de archivos al disco del usuario.
 *
 * Recepción necesita BAJAR la hoja de autorización (montaje) para mandársela
 * al cliente por fuera del sistema, así que no alcanza con abrirla en una
 * pestaña: hace falta un `<a download>` de verdad.
 *
 * Ni las `data:` URL ni las `blob:` ajenas se pueden linkear tal cual:
 *  - iOS Safari IGNORA el atributo `download` sobre una `data:` URL (abre el
 *    archivo o no hace nada) y además corta las URLs muy largas, que es
 *    exactamente el caso de un montaje de varios MB en base64.
 *  - una `blob:` URL cacheada por React Query NO se puede revocar acá
 *    (rompería la vista previa que sigue en pantalla).
 * En los dos casos se copia el contenido a una blob URL propia, se dispara la
 * descarga y se revoca esa copia.
 */
export async function downloadFromUrl(url: string, filename: string): Promise<void> {
  let href = url;
  let temporary = false;

  if (url.startsWith("blob:") || url.startsWith("data:")) {
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
