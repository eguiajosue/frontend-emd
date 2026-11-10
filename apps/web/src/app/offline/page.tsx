import type { Metadata } from "next";
import { ErrorScreen } from "@/components/feedback/ErrorScreen";

export const metadata: Metadata = {
  title: "Sin conexión · EMD marketing & design",
  robots: { index: false, follow: false },
};

/**
 * Fallback del Service Worker cuando no hay red y la pantalla no está en
 * caché. Sin JS ni animación de entrada: debe verse y funcionar aunque los
 * chunks no estén disponibles. "Reintentar" es un enlace normal al inicio.
 *
 * Es un Server Component: a `ErrorScreen` (cliente) sólo se le pasan datos
 * serializables. Pasarle un ícono (una función/componente) hacía fallar el
 * render en el servidor y esta pantalla caía en "Algo salió mal".
 */
export default function OfflinePage() {
  return (
    <ErrorScreen
      layout="page"
      variant="offline"
      plainLinks
      animate={false}
      primary={{ label: "Reintentar", href: "/dashboard" }}
    />
  );
}
