"use client";

import { RefreshCw } from "lucide-react";
import { ErrorScreen, retryAction } from "@/components/feedback/ErrorScreen";
import { BrandLogo } from "@/components/BrandLogo";
import { ApiError } from "@/lib/api";

/**
 * Estados del enlace público del cliente (`/p/<token>`) cuando no hay pedido
 * que mostrar. Cada uno dice qué pasó y qué hacer, sin tecnicismos:
 *  - invalid: el token no existe (404) o está incompleto.
 *  - expired: el enlace venció (410).
 *  - revoked: quien lo compartió lo desactivó (401/403).
 *  - offline / error: fallo temporal, con "Reintentar".
 */
export type PublicLinkStateKind = "invalid" | "expired" | "revoked" | "offline" | "error";

export function publicLinkStateForError(error: unknown): PublicLinkStateKind {
  if (error instanceof ApiError) {
    if (error.status === 404) return "invalid";
    if (error.status === 410) return "expired";
    if (error.status === 401 || error.status === 403) return "revoked";
    if (error.status === 0 && typeof navigator !== "undefined" && navigator.onLine === false) return "offline";
  }
  return "error";
}

export function PublicLinkState({
  state,
  onRetry,
  digest,
  withShell = true,
}: {
  state: PublicLinkStateKind;
  onRetry?: () => void;
  digest?: string;
  /** `false` cuando ya está dentro del Shell de la página del portal. */
  withShell?: boolean;
}) {
  const retry = onRetry ? retryAction(onRetry) : { label: "Reintentar", icon: RefreshCw, onClick: () => window.location.reload() };
  const screen =
    state === "invalid" || state === "expired" || state === "revoked" ? (
      <ErrorScreen layout="inline" variant={state} primary={null} secondary={null} digest={digest} />
    ) : state === "offline" ? (
      <ErrorScreen layout="inline" variant="offline" primary={retry} digest={digest} />
    ) : (
      <ErrorScreen
        layout="inline"
        variant="500"
        title="No pudimos cargar tu pedido"
        description="Revisa tu conexión e inténtalo de nuevo. Si sigue igual, pídenos que te reenviemos el enlace."
        primary={retry}
        digest={digest}
      />
    );

  if (!withShell) return screen;
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border/70 bg-card/85">
        <div aria-hidden className="brand-bar rounded-none" />
        <div className="mx-auto flex max-w-2xl items-center px-4 py-3">
          <BrandLogo className="h-7" priority />
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-8">{screen}</main>
    </div>
  );
}
