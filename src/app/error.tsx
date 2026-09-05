"use client";

import { useEffect } from "react";
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
    // No se loguea el error completo en producción para no exponer datos sensibles.
    if (process.env.NODE_ENV === "development") {
      console.error(error);
    }
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
      <AlertTriangle className="h-10 w-10 text-destructive" />
      <h1 className="text-2xl font-bold">Algo salió mal</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Ocurrió un error inesperado. Podés reintentar la operación o volver al
        inicio.
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground">Referencia: {error.digest}</p>
      )}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={reset}>
          <RefreshCw className="mr-2 h-4 w-4" /> Reintentar
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/dashboard">Ir al inicio</Link>
        </Button>
      </div>
    </div>
  );
}
