"use client";

import { useEffect } from "react";
import { reportErrorToSentry } from "@/lib/reportErrorToSentry";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Error boundary raíz: cubre cualquier fallo no capturado de la app. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // El boundary se "come" el error: sin esto Sentry no lo vería. Sin DSN
    // configurado no hace nada (ver lib/sentry.ts).
    reportErrorToSentry(error);
    // No se loguea el error completo en producción para no exponer datos sensibles.
    if (process.env.NODE_ENV === "development") {
      console.error(error);
    }
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
    <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-[1.75rem] border border-border/60 bg-card px-6 py-10 shadow-soft sm:px-10 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden />
      </span>
      <h1 className="font-heading text-2xl font-semibold leading-tight tracking-tight">Algo salió mal</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Ocurrió un error inesperado. Se puede reintentar la operación o volver al
        inicio.
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground">Referencia: {error.digest}</p>
      )}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={reset}>
          <RefreshCw className="h-4 w-4" /> Reintentar
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/dashboard">Ir al inicio</Link>
        </Button>
      </div>
    </div>
    </div>
  );
}
