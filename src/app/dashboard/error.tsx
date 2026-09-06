"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Error boundary del área privada: mantiene el sidebar y sólo reemplaza el contenido. */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.error(error);
    }
  }, [error]);

  return (
    <div className="mt-10 flex flex-col items-center gap-4 rounded-md border border-destructive/30 bg-destructive/5 p-10 text-center">
      <AlertTriangle className="h-8 w-8 text-destructive" />
      <div>
        <p className="text-lg font-semibold">No pudimos mostrar esta sección</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Ocurrió un error al cargar la pantalla. Intentá de nuevo; si el
          problema persiste, avisá a un administrador.
        </p>
      </div>
      {error.digest && (
        <p className="text-xs text-muted-foreground">Referencia: {error.digest}</p>
      )}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={reset}>
          <RefreshCw className="mr-2 h-4 w-4" /> Reintentar
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/dashboard">Volver al inicio</Link>
        </Button>
      </div>
    </div>
  );
}
