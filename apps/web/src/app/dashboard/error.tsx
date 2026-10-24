"use client";

import { useEffect } from "react";
import { ErrorScreen, retryAction, variantForError } from "@/components/feedback/ErrorScreen";
import { reportErrorToSentry } from "@/lib/reportErrorToSentry";

/** Error boundary del área privada: mantiene el sidebar y sólo reemplaza el contenido. */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportErrorToSentry(error);
    if (process.env.NODE_ENV === "development") {
      console.error(error);
    }
  }, [error]);

  const variant = variantForError(error);
  const recoverable = variant === "500" || variant === "offline" || variant === "429" || variant === "503";

  return (
    <ErrorScreen
      variant={variant}
      title={variant === "500" ? "No pudimos mostrar esta sección" : undefined}
      description={
        variant === "500"
          ? "Ocurrió un error al cargar la pantalla. Reintenta; si el problema persiste, avisa a un administrador con la referencia."
          : undefined
      }
      digest={error.digest}
      primary={recoverable ? retryAction(reset) : undefined}
      secondary={recoverable ? { label: "Volver al inicio", href: "/dashboard" } : null}
    />
  );
}
