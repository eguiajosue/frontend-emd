"use client";

import { useEffect } from "react";
import { ErrorScreen, retryAction, variantForError } from "@/components/feedback/ErrorScreen";
import { reportErrorToSentry } from "@/lib/reportErrorToSentry";

/** Falla al pintar el detalle de un pedido: la lista y el resto del dashboard siguen usables. */
export default function OrderDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportErrorToSentry(error);
    if (process.env.NODE_ENV === "development") console.error(error);
  }, [error]);

  const variant = variantForError(error);
  const recoverable = variant === "500" || variant === "offline" || variant === "429" || variant === "503";
  return (
    <ErrorScreen
      variant={variant}
      title={variant === "500" ? "No pudimos abrir este pedido" : undefined}
      digest={error.digest}
      primary={recoverable ? retryAction(reset) : undefined}
      secondary={{ label: "Ver pedidos", href: "/dashboard/orders" }}
    />
  );
}
