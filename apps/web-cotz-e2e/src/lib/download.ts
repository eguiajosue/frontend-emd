/**
 * Descarga de archivos al disco del usuario.
 *
 * Recepción necesita BAJAR la hoja de autorización (montaje) para mandársela
 * al cliente por fuera del sistema, así que no alcanza con abrirla en una
 * pestaña: hace falta un `<a download>` de verdad.
 *
 * Una `data:` URL no se puede linkear tal cual: iOS Safari IGNORA el atributo
 * `download` sobre ella (abre el archivo o no hace nada) y además corta las
 * URLs muy largas, que es exactamente el caso de un montaje o un mockup de
 * varios MB en base64. Se decodifica a una blob URL propia, se dispara la
 * descarga y se revoca esa copia.
 *
 * Una `blob:` URL (p. ej. cacheada por React Query) se linkea directo y NO se
 * revoca aquí: rompería la vista previa que sigue en pantalla.
 *
 * Nada de `fetch()` sobre `data:`/`blob:`: la CSP (`connect-src` en
 * next.config.ts) no los permite y la descarga fallaba en producción.
 */
export async function downloadFromUrl(url: string, filename: string): Promise<void> {
  let href = url;
  let temporary = false;

  if (url.startsWith("data:")) {
    href = URL.createObjectURL(dataUrlToBlob(url));
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

/** Decodifica una `data:` URL (base64 o texto) a un Blob, sin `fetch()`. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) throw new Error("data URL inválida");
  const meta = dataUrl.slice(5, comma);
  const data = dataUrl.slice(comma + 1);
  const isBase64 = /;base64$/i.test(meta);
  const type = (isBase64 ? meta.slice(0, -";base64".length) : meta).split(";")[0] || "application/octet-stream";
  if (!isBase64) return new Blob([decodeURIComponent(data)], { type });
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}
