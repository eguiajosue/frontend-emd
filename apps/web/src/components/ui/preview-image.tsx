import type { ImgHTMLAttributes } from "react";

type PreviewImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "alt"> & {
  alt: string;
};

/**
 * `<img>` para fuentes que `next/image` no puede optimizar.
 *
 * Todas las imágenes de la app son de origen local en tiempo de ejecución:
 * `blob:` de un archivo recién elegido, `data:` de un archivo del cliente
 * embebido en el JSON del pedido, u object URLs de descargas autenticadas. El
 * optimizador de Next necesita una URL remota que pueda buscar desde el
 * servidor, así que sobre estas no hace nada — sólo agrega peso y un dominio
 * que configurar. `next/image` sigue siendo lo correcto para assets estáticos.
 *
 * Centralizado acá para tener un único lugar donde silenciar la regla, con el
 * motivo escrito, en vez de siete `eslint-disable` sueltos.
 */
export function PreviewImage({ alt, ...props }: PreviewImageProps) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img alt={alt} {...props} />;
}
