"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

/**
 * Sección del detalle de pedido. Un solo plano: las secciones se separan con
 * una línea y aire, no con una tarjeta cada una — antes había hasta tres
 * niveles de recuadro anidado y todo pesaba lo mismo.
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
      className={cn("scroll-mt-28 space-y-3 border-t pt-5", className)}
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
      className="group scroll-mt-28 border-t pt-5"
    >
      <CollapsibleTrigger className="flex min-h-8 w-full items-center gap-3 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/60">
        <h3 className="text-section-title">{title}</h3>
        {summary && !open && (
          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{summary}</span>
        )}
        <ChevronDown
          aria-hidden
          className="ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180"
        />
      </CollapsibleTrigger>
      <CollapsibleContent forceMount className="pt-3 data-[state=closed]:hidden">
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
    <div className={cn("min-w-0 space-y-0.5", className)}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{children}</dd>
    </div>
  );
}
