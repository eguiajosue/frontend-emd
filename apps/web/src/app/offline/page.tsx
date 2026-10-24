import { RefreshCw } from "lucide-react";
import { ErrorScreen } from "@/components/feedback/ErrorScreen";

/**
 * Fallback del Service Worker cuando no hay red y la pantalla no está en
 * caché. Sin JS ni animación de entrada: debe verse y funcionar aunque los
 * chunks no estén disponibles. "Reintentar" es un enlace normal al inicio.
 */
export default function OfflinePage() {
  return (
    <ErrorScreen
      layout="page"
      variant="offline"
      plainLinks
      animate={false}
      primary={{ label: "Reintentar", icon: RefreshCw, href: "/dashboard" }}
    />
  );
}
