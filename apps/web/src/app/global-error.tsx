"use client";

import { useEffect } from "react";
import { reportErrorToSentry } from "@/lib/reportErrorToSentry";
import "./globals.css";

/**
 * Último recurso: un error en el propio layout raíz (fuera del alcance de
 * `app/error.tsx`). Reemplaza al layout, por eso trae su propio `<html>` y
 * `<body>` y no usa providers ni componentes que dependan de ellos.
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
  }, [error]);

  return (
    <html lang="es">
      <body className="font-sans antialiased">
        <div className="flex min-h-dvh items-center justify-center bg-background p-4">
          <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-[1.75rem] border border-border/60 bg-card px-6 py-10 text-center sm:px-10">
            <h1 className="text-2xl font-semibold leading-tight tracking-tight">Algo salió mal</h1>
            <p className="max-w-sm text-sm text-muted-foreground">
              Ocurrió un error inesperado. Recarga la página para intentarlo de nuevo.
            </p>
            {error.digest && (
              <p className="text-xs text-muted-foreground">Referencia: {error.digest}</p>
            )}
            {/* Recarga completa: el layout raíz falló, `reset()` no alcanza. */}
            <a
              href="/dashboard"
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              Ir al inicio
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
