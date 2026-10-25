import { cn } from "@/lib/utils";

interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** `wide` (default) usa todo el ancho útil; `narrow` limita a 64rem (formularios, ajustes); `prose` a 44rem. */
  width?: "wide" | "narrow" | "prose";
}

const WIDTH = { wide: "", narrow: "max-w-5xl", prose: "max-w-2xl" } as const;

/**
 * Contenedor de contenido de página: ritmo vertical de 24px entre bloques
 * (`space-y-6`). El padding horizontal y el ancho máximo (110rem) ya los pone
 * `dashboard/layout.tsx`; esto sólo organiza el interior.
 */
export function PageContainer({ width = "wide", className, ...props }: PageContainerProps) {
  return <div className={cn("space-y-6", WIDTH[width], width !== "wide" && "mx-auto", className)} {...props} />;
}

interface PageSectionProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Acciones alineadas con el título de la sección. */
  actions?: React.ReactNode;
}

/** Sección con título (text-section-title) y acciones; separa bloques sin anidar tarjetas. */
export function PageSection({ title, description, actions, className, children, ...props }: PageSectionProps) {
  return (
    <section className={cn("space-y-3", className)} {...props}>
      {(title || actions) && (
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="text-section-title">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
