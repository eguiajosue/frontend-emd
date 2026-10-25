"use client";

import Link from "next/link";
import { Children, useEffect, useState, type ReactNode } from "react";
import { ChevronRight, Loader2, RefreshCw, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { useNotifications } from "@/hooks/useNotifications";
import { notificationHref } from "@/lib/notifications";
import { describeOrderProducts } from "@/lib/createOrderForm";
import { PRIORITY_LABEL, relativeTo, type WorkPriority } from "@/lib/homeDashboard";
import { cn } from "@/lib/utils";
import { AnimatedNumber, FadeIn, Stagger, StaggerItem } from "@/components/motion";

/* -------------------------------- En vivo --------------------------------- */

/**
 * "En vivo · actualizado hace 5 s": el tablero se refresca solo cuando cambia
 * algo (socket) y, por las dudas, cada minuto. El botón fuerza un refresco.
 */
export function LiveStatus({
  updatedAt,
  isFetching,
  onRefresh,
}: {
  updatedAt: number;
  isFetching: boolean;
  onRefresh: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);
  const seconds = updatedAt ? Math.max(0, Math.round((now - updatedAt) / 1000)) : null;
  const ago =
    seconds === null ? "" : seconds < 60 ? "hace instantes" : relativeTo(new Date(updatedAt).toISOString(), now);

  return (
    <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/60 bg-card py-1 pl-3 pr-1 shadow-soft-xs text-sm text-muted-foreground">
      <span className="relative flex h-2 w-2" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime opacity-70 motion-reduce:hidden" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-lime-strong dark:bg-lime" />
      </span>
      <span>
        <span className="font-medium text-foreground">En vivo</span>
        {ago && <span aria-live="off"> · actualizado {ago}</span>}
      </span>
      <SimpleTooltip label="Actualizar ahora">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full"
          onClick={onRefresh}
          aria-label="Actualizar ahora"
          disabled={isFetching}
        >
          {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </Button>
      </SimpleTooltip>
    </div>
  );
}

/* --------------------------------- Métricas ------------------------------- */

const TONE_CLASSES = {
  default: "text-muted-foreground",
  danger: "text-destructive",
  warn: "text-warning",
  info: "text-cyan-ink dark:text-cyan",
  good: "text-lime-ink dark:text-lime",
} as const;

/** Fondo tintado del icono cuando la métrica "importa" (> 0). */
const TONE_CHIP = {
  default: "bg-muted text-muted-foreground",
  danger: "bg-destructive/10 text-destructive",
  warn: "bg-warning-soft text-warning",
  info: "bg-cyan/25 text-cyan-ink dark:bg-cyan/15 dark:text-cyan",
  good: "bg-lime/30 text-lime-ink dark:bg-lime/15 dark:text-lime",
} as const;

export type StatTone = keyof typeof TONE_CLASSES;

/**
 * Una métrica del tablero. Con `href` es un acceso directo a la lista
 * filtrada; el color sólo aparece cuando el número importa (> 0). Las cifras
 * numéricas cuentan hacia arriba al entrar en pantalla.
 */
export function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
  href,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  hint?: ReactNode;
  tone?: StatTone;
  href?: string;
}) {
  const active = tone !== "default" && value !== 0 && value !== "0";
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-label">{label}</span>
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105",
            active ? TONE_CHIP[tone] : TONE_CHIP.default
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>
      <p
        className={cn(
          "font-heading text-3xl font-semibold leading-none tracking-tight tabular-nums",
          active && tone === "danger" ? TONE_CLASSES.danger : "text-foreground"
        )}
      >
        {typeof value === "number" ? <AnimatedNumber value={value} /> : value}
      </p>
      {hint && <p className="text-meta">{hint}</p>}
    </>
  );
  const className =
    "group flex min-w-0 flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-soft dark:border-border";
  return href ? (
    <Link
      href={href}
      className={cn(className, "interactive-lift hover:border-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60")}
    >
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

/** Rejilla de métricas con entrada escalonada (fade + sube 10px, reduced-motion safe). */
export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Stagger className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6", className)}>
      {Children.toArray(children).map((child, i) => (
        <StaggerItem key={i} className="min-w-0 [&>*]:h-full">
          {child}
        </StaggerItem>
      ))}
    </Stagger>
  );
}

/* --------------------------------- Secciones ------------------------------ */

export function HomeSection({
  id,
  title,
  count,
  action,
  description,
  children,
  className,
}: {
  id: string;
  title: string;
  count?: number;
  action?: { label: string; href: string };
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <FadeIn inView className="min-w-0">
    <section aria-labelledby={id} className={cn("min-w-0 space-y-3", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <h2 id={id} className="flex items-center gap-2 text-section-title">
            <span className="h-4 w-1 rounded-full bg-accent-gradient" aria-hidden />
            {title}
            {count !== undefined && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-primary dark:text-foreground">
                {count}
              </span>
            )}
          </h2>
          {description && <p className="text-meta">{description}</p>}
        </div>
        {action && (
          <Link
            href={action.href}
            className="group/link inline-flex shrink-0 items-center gap-0.5 rounded-full text-sm font-medium text-muted-foreground transition-colors hover:text-magenta-ink dark:hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            {action.label}
            <ChevronRight className="h-4 w-4 transition-transform duration-150 group-hover/link:translate-x-0.5" aria-hidden />
          </Link>
        )}
      </div>
      {children}
    </section>
    </FadeIn>
  );
}

/** Tarjeta contenedora de una lista o panel (una sola capa: nunca tarjetas anidadas). */
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-border/60 bg-card shadow-soft dark:border-border", className)}>
      {children}
    </div>
  );
}

/* ---------------------------------- Piezas -------------------------------- */

export function productsLine(products: Array<{ customName?: string | null; quantity: number }>): string {
  return describeOrderProducts(products, 3);
}

export const PRIORITY_PILL: Record<WorkPriority, string> = {
  overdue: "bg-destructive/10 text-destructive",
  changes: "bg-orange-500/10 text-orange-700 dark:bg-orange-400/15 dark:text-orange-300",
  due_soon: "bg-warning-soft text-warning",
  not_started: "bg-muted text-foreground/80",
  in_progress: "bg-info-soft text-info",
};

/** Etiqueta en singular de la prioridad, para la píldora de cada fila. */
const PRIORITY_SINGULAR: Record<WorkPriority, string> = {
  overdue: "Vencido",
  changes: "Con cambios",
  due_soon: "Por vencer",
  not_started: "Sin empezar",
  in_progress: "En curso",
};

export function PriorityPill({ priority }: { priority: WorkPriority }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium",
        PRIORITY_PILL[priority]
      )}
    >
      {PRIORITY_SINGULAR[priority]}
    </span>
  );
}

export { PRIORITY_LABEL };

/* ---------------------------------- Avisos -------------------------------- */

/** Últimas notificaciones del usuario (las no leídas resaltadas). */
export function RecentNotices({ limit = 5 }: { limit?: number }) {
  const { notifications, isLoading } = useNotifications(1, limit);
  const now = Date.now();
  if (isLoading) return <p className="px-4 py-3 text-meta" role="status">Cargando avisos…</p>;
  if (notifications.length === 0) {
    return <p className="px-4 py-3 text-sm text-muted-foreground">Sin avisos nuevos.</p>;
  }
  return (
    <ul className="divide-y divide-border/60">
      {notifications.map((n) => {
        const href = notificationHref(n);
        const content = (
          <>
            <span
              className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-magenta")}
              aria-hidden
            />
            <span className="min-w-0 flex-1">
              <span className={cn("block truncate text-sm", !n.read && "font-medium")}>{n.title}</span>
              {n.body && <span className="block truncate text-meta">{n.body}</span>}
            </span>
            <span className="shrink-0 text-meta">{relativeTo(n.createdAt, now)}</span>
          </>
        );
        return (
          <li key={n.id}>
            {href ? (
              <Link
                href={href}
                className="flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
              >
                {content}
              </Link>
            ) : (
              <div className="flex items-start gap-3 px-4 py-2.5">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
