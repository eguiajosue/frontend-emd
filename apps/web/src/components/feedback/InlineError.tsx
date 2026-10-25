"use client";

import { AlertCircle, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { describeError, type ErrorInfo } from "@/lib/errorMessages";
import { cn } from "@/lib/utils";

/**
 * Error compacto dentro de un panel, diálogo o formulario (no ocupa la
 * pantalla). Toma el mensaje del catálogo a partir del error, o texto propio.
 * Si el error es recuperable y hay `onRetry`, ofrece el botón de reintentar.
 */
export function InlineError({
  error,
  message,
  title,
  onRetry,
  className,
}: {
  error?: unknown;
  /** Texto propio; si falta se usa el del catálogo para `error`. */
  message?: string;
  title?: string;
  onRetry?: () => void;
  className?: string;
}) {
  const info: ErrorInfo | undefined = error !== undefined ? describeError(error) : undefined;
  const text = message ?? info?.description ?? "Ocurrió un error inesperado. Inténtalo de nuevo.";
  const heading = title ?? (message ? undefined : info?.title);
  const Icon = info && (info.kind === "offline" || info.kind === "network") ? WifiOff : AlertCircle;
  const canRetry = Boolean(onRetry) && (info ? info.retryable : true);

  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-xl border border-destructive/25 bg-destructive/5 px-3.5 py-3 text-sm",
        className
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
      <div className="min-w-0 flex-1">
        {heading && <p className="font-medium text-foreground">{heading}</p>}
        <p className={cn("text-muted-foreground", !heading && "text-foreground")}>{text}</p>
      </div>
      {canRetry && (
        <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={onRetry}>
          <RefreshCw aria-hidden /> Reintentar
        </Button>
      )}
    </div>
  );
}
