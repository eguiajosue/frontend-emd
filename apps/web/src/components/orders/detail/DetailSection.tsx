"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

/**
 * Superficie de cada bloque del detalle: tarjeta blanca grande, casi sin
 * borde, sobre el lienzo gris. Un solo nivel — lo de adentro se agrupa con
 * fondos `bg-muted`, nunca con otra tarjeta.
 */
export const DETAIL_BLOCK_CLASS =
  "rounded-2xl border border-border/60 bg-card p-5 shadow-soft sm:p-6";

/**
 * Sección del detalle de pedido: un bloque por sección, con título arriba y
 * mucho aire adentro.
 */
export function DetailSection({
  id,
  title,
  action,
  children,
  className,
}: {
  id?: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn("scroll-mt-28 space-y-4", DETAIL_BLOCK_CLASS, className)}
    >
      <header className="flex min-h-8 items-center justify-between gap-3">
        <h3 id={headingId} className="text-section-title">
          {title}
        </h3>
        {action}
      </header>
      {children}
    </section>
  );
}

/**
 * Sección plegable para lo secundario (diseño ya resuelto, actividad).
 * Collapsible de shadcn con `forceMount`: el contenido queda montado aunque
 * esté cerrado, así no se pierde estado interno (rondas abiertas,
 * confirmaciones) al plegar.
 */
export function CollapsibleSection({
  id,
  title,
  summary,
  defaultOpen = false,
  onOpenChange,
  children,
}: {
  id?: string;
  title: string;
  /** Una línea con lo esencial, visible con la sección cerrada. */
  summary?: ReactNode;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible
      id={id}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        onOpenChange?.(next);
      }}
      className={cn("group scroll-mt-28", DETAIL_BLOCK_CLASS)}
    >
      <CollapsibleTrigger className="-m-2 flex min-h-8 w-[calc(100%+1rem)] items-center gap-3 rounded-xl p-2 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/60">
        <h3 className="text-section-title">{title}</h3>
        {summary && !open && (
          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{summary}</span>
        )}
        <span className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <ChevronDown
            aria-hidden
            className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180"
          />
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent forceMount className="pt-4 data-[state=closed]:hidden">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Par etiqueta / valor de los datos del pedido (dentro de un `<dl>`). */
export function DetailField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 space-y-1", className)}>
      <dt className="text-label">{label}</dt>
      <dd className="text-sm font-medium">{children}</dd>
    </div>
  );
}
