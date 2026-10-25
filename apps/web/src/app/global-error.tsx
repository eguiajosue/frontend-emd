"use client";

import { useEffect } from "react";
import { ErrorScreen } from "@/components/feedback/ErrorScreen";
import { reportErrorToSentry } from "@/lib/reportErrorToSentry";
import "./globals.css";

/**
 * Último recurso: un error en el propio layout raíz (fuera del alcance de
 * `app/error.tsx`). Reemplaza al layout, por eso trae su propio `<html>` y
 * `<body>` y no usa providers (sin sesión, tema ni react-query). Los enlaces
 * son `<a>` (`plainLinks`) y el reintento es una recarga completa: si el
 * layout raíz falló, `reset()` no alcanza.
 *
 * Reporta a Sentry sólo si está configurado (ver lib/reportErrorToSentry.ts).
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    reportErrorToSentry(error);
    // Sin ThemeProvider: aplica el tema guardado por next-themes (o el del
    // sistema) para que el modo oscuro también funcione en esta pantalla.
    try {
      const saved = localStorage.getItem("theme");
      const dark =
        saved === "dark" || ((!saved || saved === "system") && window.matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.classList.toggle("dark", dark);
    } catch {
      // Sin localStorage: se queda el tema por defecto.
    }
  }, [error]);

  return (
    <html lang="es" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ErrorScreen
          layout="page"
          variant="500"
          plainLinks
          digest={error.digest}
          primary={{ label: "Recargar la página", onClick: () => window.location.reload() }}
          secondary={{ label: "Ir al inicio", href: "/dashboard" }}
        />
      </body>
    </html>
  );
}
