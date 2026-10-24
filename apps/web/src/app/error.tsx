"use client";

import { useEffect } from "react";
import { ErrorScreen, retryAction, variantForError } from "@/components/feedback/ErrorScreen";
import { reportErrorToSentry } from "@/lib/reportErrorToSentry";

/** Error boundary raíz: cubre cualquier fallo no capturado de la app. */
export default function RootError({
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

  const variant = variantForError(error);
  const recoverable = variant === "500" || variant === "offline" || variant === "429" || variant === "503";

  return (
    <ErrorScreen
      layout="page"
      variant={variant}
      digest={error.digest}
      primary={recoverable ? retryAction(reset) : undefined}
      secondary={recoverable ? { label: "Ir al inicio", href: "/dashboard" } : null}
    />
  );
}
