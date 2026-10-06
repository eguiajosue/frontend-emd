"use client";

import { motion } from "framer-motion";
import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Estados compartidos de carga / vacío / error.
 * Unifican el feedback en todas las pantallas: mismas alturas, mismos textos
 * y siempre un botón de reintentar cuando la acción es recuperable.
 */

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    // Misma superficie que `DataTable`: panel blanco con encabezado chico y
    // filas separadas por línea suave, así el salto a los datos no mueve nada.
    <div
      className="mt-4 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-soft"
      role="status"
      aria-busy="true"
      aria-label="Cargando"
    >
      <div className="flex h-11 items-center gap-6 border-b border-border/60 px-5">
        <Skeleton className="bg-muted h-3 w-20 rounded-full" />
        <Skeleton className="bg-muted h-3 w-16 rounded-full" />
        <Skeleton className="bg-muted hidden h-3 w-24 rounded-full sm:block" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex h-14 items-center gap-6 border-b border-border/60 px-5 last:border-b-0"
        >
          <Skeleton className="bg-muted h-4 w-1/4 rounded-full" style={{ animationDelay: `${i * 60}ms` }} />
          <Skeleton className="bg-muted h-4 w-1/5 rounded-full" style={{ animationDelay: `${i * 60}ms` }} />
          <Skeleton
            className="bg-muted hidden h-4 w-1/3 rounded-full sm:block"
            style={{ animationDelay: `${i * 60}ms` }}
          />
        </div>
      ))}
    </div>
  );
}

export function CardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      role="status"
      aria-busy="true"
      aria-label="Cargando"
    >
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton
          key={i}
          className="bg-muted h-28 w-full rounded-2xl"
          style={{ animationDelay: `${i * 80}ms` }}
        />
      ))}
    </div>
  );
}

export function MessageThreadSkeleton() {
  return (
    <div className="space-y-3" role="status" aria-busy="true" aria-label="Cargando mensajes">
      {[70, 45, 85, 55].map((width, i) => (
        <div
          key={i}
          className={cn("flex", i % 2 === 0 ? "justify-start" : "justify-end")}
        >
          <Skeleton
            className="bg-muted h-10 rounded-2xl"
            style={{ width: `${width}%`, animationDelay: `${i * 60}ms` }}
          />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-border/60 bg-card px-6 py-12 text-center text-sm text-muted-foreground shadow-soft"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Inbox className="h-5 w-5" aria-hidden />
      </span>
      <p className="max-w-sm">{message}</p>
    </motion.div>
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
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      role="alert"
      className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-border/60 bg-card px-6 py-12 text-center shadow-soft"
    >
      {/* El color va sólo en el círculo del ícono: la tarjeta sigue siendo
          blanca, como cualquier otra superficie. */}
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden />
      </span>
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" className="mt-1" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" /> Reintentar
        </Button>
      )}
    </motion.div>
  );
}
