"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Estados compartidos de carga / vacío / error.
 * Unifican el feedback en todas las pantallas: mismas alturas, mismos textos
 * y siempre un botón de reintentar cuando la acción es recuperable.
 */

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-4 mt-4" role="status" aria-label="Cargando">
      <Skeleton className="w-full h-10" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="w-full h-10" />
      ))}
    </div>
  );
}

export function CardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      role="status"
      aria-label="Cargando"
    >
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-28 w-full" />
      ))}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="mt-6 rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "No se pudo cargar la información",
  description = "Ocurrió un problema al comunicarse con el servidor.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="mt-6 flex flex-col items-center gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-10 text-center">
      <AlertTriangle className="h-8 w-8 text-destructive" />
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" /> Reintentar
        </Button>
      )}
    </div>
  );
}
