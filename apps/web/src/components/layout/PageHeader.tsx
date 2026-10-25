import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { FadeIn } from "@/components/motion/FadeIn";

interface PageHeaderProps {
  /** Título de la página (h1). Uno por pantalla. */
  title: React.ReactNode;
  /** Una línea de contexto bajo el título. */
  description?: React.ReactNode;
  /** Ícono opcional en cuadro marino a la izquierda del título. */
  icon?: LucideIcon;
  /** Acciones de la página (botones). A la derecha en escritorio, debajo en móvil. La primaria va al final. */
  actions?: React.ReactNode;
  /** Fila inferior: pestañas, filtros, chips. */
  children?: React.ReactNode;
  className?: string;
}

/**
 * Encabezado estándar de página. TODA pantalla del dashboard empieza con uno:
 * título (font-heading) + descripción + acciones, con entrada fade-up de 250ms.
 *
 *   <PageContainer>
 *     <PageHeader title="Pedidos" description="…" actions={<Button variant="brand">Nuevo pedido</Button>} />
 *     …
 *   </PageContainer>
 */
export function PageHeader({ title, description, icon: Icon, actions, children, className }: PageHeaderProps) {
  return (
    <FadeIn className={cn("space-y-4 pb-1", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div className="flex min-w-0 items-center gap-3">
          {Icon && (
            <span
              aria-hidden
              className="hidden size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-soft sm:flex"
            >
              <Icon className="size-5" />
            </span>
          )}
          <div className="min-w-0">
            <h1 className="text-page-title truncate">{title}</h1>
            {description && <p className="mt-1 max-w-prose text-sm text-muted-foreground">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </FadeIn>
  );
}
