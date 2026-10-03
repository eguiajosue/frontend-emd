"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { ChevronRight, Loader2, RefreshCw, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { useNotifications } from "@/hooks/useNotifications";
import { notificationHref } from "@/lib/notifications";
import { describeOrderProducts } from "@/lib/createOrderForm";
import { PRIORITY_LABEL, relativeTo, type WorkPriority } from "@/lib/homeDashboard";
import { cn } from "@/lib/utils";

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
    <div className="inline-flex w-fit items-center gap-2 rounded-full bg-card py-1 pl-3 pr-1 text-sm text-muted-foreground">
      <span className="relative flex h-2 w-2" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:hidden" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
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
  danger: "text-rose-600 dark:text-rose-400",
  warn: "text-amber-600 dark:text-amber-400",
  info: "text-sky-600 dark:text-sky-400",
  good: "text-emerald-600 dark:text-emerald-400",
} as const;

export type StatTone = keyof typeof TONE_CLASSES;

/**
 * Una métrica del tablero. Con `href` es un acceso directo a la lista
 * filtrada; el color sólo aparece cuando el número importa (> 0).
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
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted",
            active ? TONE_CLASSES[tone] : "text-muted-foreground"
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>
      <p
        className={cn(
          "font-heading text-3xl font-semibold leading-none tabular-nums",
          active && tone === "danger" && "text-rose-600 dark:text-rose-400"
        )}
      >
        {value}
      </p>
      {hint && <p className="text-meta">{hint}</p>}
    </>
  );
  const className =
    "flex min-w-0 flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-soft dark:border-border";
  return href ? (
    <Link
      href={href}
      className={cn(
        className,
        "transition-[border-color,box-shadow] hover:border-border hover:shadow-soft-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      )}
    >
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
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
    <section aria-labelledby={id} className={cn("min-w-0 space-y-3", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <h2 id={id} className="flex items-center gap-2 text-section-title">
            {title}
            {count !== undefined && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                {count}
              </span>
            )}
          </h2>
          {description && <p className="text-meta">{description}</p>}
        </div>
        {action && (
          <Link
            href={action.href}
            className="inline-flex shrink-0 items-center gap-0.5 rounded-full text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            {action.label}
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

/** Tarjeta contenedora de una lista o panel (una sola capa: nunca tarjetas anidadas). */
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-border/60 bg-card shadow-soft dark:border-border", className)}>
      {children}
    </div>
  );
}

/* ---------------------------------- Piezas -------------------------------- */

export function productsLine(products: Array<{ customName?: string | null; quantity: number }>): string {
  return describeOrderProducts(products, 3);
}

export const PRIORITY_PILL: Record<WorkPriority, string> = {
  overdue: "bg-rose-500/10 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300",
  changes: "bg-orange-500/10 text-orange-700 dark:bg-orange-400/15 dark:text-orange-300",
  due_soon: "bg-amber-500/10 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
  not_started: "bg-muted text-foreground/80",
  in_progress: "bg-sky-500/10 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300",
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
  if (isLoading) return <p className="px-4 py-3 text-meta">Cargando avisos…</p>;
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
              className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-primary")}
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
                className="flex items-start gap-3 px-4 py-2.5 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
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
