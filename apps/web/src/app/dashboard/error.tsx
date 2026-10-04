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
    <div className="mx-auto mt-10 flex max-w-xl flex-col items-center gap-4 rounded-[1.75rem] border border-border/60 bg-card px-6 py-10 shadow-soft sm:px-10 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden />
      </span>
      <div>
        <p className="text-lg font-semibold">No pudimos mostrar esta sección</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          Ocurrió un error al cargar la pantalla. Intentar de nuevo; si el
          problema persiste, avisa a un administrador.
        </p>
      </div>
      {error.digest && (
        <p className="text-xs text-muted-foreground">Referencia: {error.digest}</p>
      )}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={reset}>
          <RefreshCw className="h-4 w-4" /> Reintentar
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/dashboard">Volver al inicio</Link>
        </Button>
      </div>
    </div>
  );
}
