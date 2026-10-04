"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight,
  CircleCheckBig,
  Flame,
  Inbox,
  PartyPopper,
  RotateCcw,
  Timer,
  UserRoundSearch,
} from "lucide-react";
import { GreetingHeader } from "@/components/admin/GreetingHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/feedback/states";
import { OrderDetailDialog } from "@/components/orders/OrderDetailDialog";
import { useDesignDashboard } from "@/hooks/useDashboard";
import { useNow } from "@/hooks/useNow";
import { getAreaLabel } from "@/lib/areas";
import {
  PRIORITY_LABEL,
  dueText,
  groupByPriority,
  isChangesRequested,
  prioritizeDesign,
  relativeTo,
  type Prioritized,
} from "@/lib/homeDashboard";
import { cn } from "@/lib/utils";
import type { DesignDashboard, DesignWorkItem } from "@/types";
import { HomeSection, LiveStatus, Panel, PriorityPill, RecentNotices, StatTile, productsLine } from "./HomeShared";

function whoLine(item: DesignWorkItem): string {
  if (item.mine) return "Tuyo";
  return item.assignee ? item.assignee.name : "Libre para tomar";
}

/** Qué pasa con el diseño, en una línea. */
function stateLine(item: DesignWorkItem, now: number): string {
  if (isChangesRequested(item.status)) {
    return `El cliente pidió cambios ${relativeTo(item.lastFeedbackAt ?? item.availableSince, now)}`;
  }
  if (!item.designStartedAt) return `Entró ${relativeTo(item.availableSince, now)} · nadie lo abrió`;
  return `Empezado ${relativeTo(item.designStartedAt, now)}${item.designStartedByName ? ` por ${item.designStartedByName}` : ""}`;
}

function actionLabel(item: DesignWorkItem): string {
  if (isChangesRequested(item.status)) return "Ver cambios";
  return item.designStartedAt ? "Continuar" : "Abrir y empezar";
}

function Meta({ item, now }: { item: DesignWorkItem; now: number }) {
  return (
    <span className="block truncate text-meta">
      <span className="tabular-nums">#{item.id}</span> · {item.clientName}
      {item.round > 0 ? ` · ronda ${item.round + (isChangesRequested(item.status) ? 1 : 0)}` : ""}
      {item.areas.length > 0 ? ` · luego ${item.areas.map((a) => getAreaLabel(a)).join(", ")}` : ""} ·{" "}
      {dueText(item.deliveryDate, now)} · {whoLine(item)}
    </span>
  );
}

function NextUp({ entry, now, onOpen }: { entry: Prioritized<DesignWorkItem>; now: number; onOpen: () => void }) {
  const { item, priority } = entry;
  return (
    <Panel className="space-y-4 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <PriorityPill priority={priority} />
        <span className="text-meta">{stateLine(item, now)}</span>
      </div>
      <div className="min-w-0 space-y-1">
        <p className="font-heading text-xl font-semibold leading-snug">{productsLine(item.products)}</p>
        <p className="line-clamp-2 text-sm text-muted-foreground">
          <span className="tabular-nums">#{item.id}</span> · {item.clientName}
          {item.description ? ` · ${item.description}` : ""}
        </p>
      </div>
      <p
        className={cn(
          "text-sm font-medium",
          priority === "overdue" ? "text-rose-600 dark:text-rose-400" : priority === "due_soon" ? "text-amber-700 dark:text-amber-300" : "text-foreground/80"
        )}
      >
        {dueText(item.deliveryDate, now)} · {whoLine(item)}
      </p>
      <Button type="button" size="lg" className="gap-2" onClick={onOpen}>
        {isChangesRequested(item.status) ? <RotateCcw className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
        {actionLabel(item)}
      </Button>
    </Panel>
  );
}

function subtitleFor(data: DesignDashboard | undefined): string {
  if (!data) return "Tu bandeja de diseño, por prioridad.";
  const c = data.counters;
  const parts: string[] = [];
  if (c.changesRequested) parts.push(`${c.changesRequested} con cambios del cliente`);
  parts.push(`${c.notStarted} nuevo${c.notStarted === 1 ? "" : "s"} sin empezar`);
  parts.push(`${c.inProgress} en curso`);
  if (c.waitingClient) parts.push(`${c.waitingClient} esperando autorización`);
  return `Diseño: ${parts.join(" · ")}.`;
}

/**
 * Inicio de Diseño: la bandeja por prioridad (vencidos, lo que volvió con
 * cambios del cliente, lo que vence pronto, lo nuevo sin abrir y lo que ya
 * está en curso), el siguiente diseño destacado y, al costado, lo que espera
 * autorización del cliente, la carga del equipo, las rondas y los avisos.
 */
export function DesignHome({ firstName, switcher }: { firstName?: string | null; switcher?: ReactNode }) {
  const { data, isLoading, isError, isFetching, updatedAt, refetch } = useDesignDashboard();
  const now = useNow(60_000);
  const [openOrderId, setOpenOrderId] = useState<number | null>(null);

  const prioritized = useMemo(() => (data ? prioritizeDesign(data.items, now) : []), [data, now]);
  const groups = useMemo(() => groupByPriority(prioritized), [prioritized]);
  const next = prioritized[0];

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <GreetingHeader firstName={firstName} subtitle={subtitleFor(data)} />
        <div className="flex flex-wrap items-center gap-3">
          <LiveStatus updatedAt={updatedAt} isFetching={isFetching} onRefresh={() => void refetch()} />
          {switcher}
        </div>
      </div>

      {isError && !data ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : isLoading || !data ? (
        <div className="space-y-6" aria-hidden>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <StatTile icon={RotateCcw} label="Cambios del cliente" value={data.counters.changesRequested} tone="warn" hint="el cliente espera" />
            <StatTile icon={Inbox} label="Nuevos sin empezar" value={data.counters.notStarted} tone="warn" />
            <StatTile icon={Timer} label="En curso" value={data.counters.inProgress} tone="info" />
            <StatTile icon={UserRoundSearch} label="Esperando al cliente" value={data.counters.waitingClient} hint="autorización del montaje" />
            <StatTile
              icon={Flame}
              label="Vencidos"
              value={data.counters.overdue}
              tone="danger"
              hint={`${data.counters.atRisk} por vencer en 48 h`}
            />
            <StatTile
              icon={CircleCheckBig}
              label="Autorizados hoy"
              value={data.counters.approvedToday}
              tone="good"
              hint={`${data.counters.approvedWeek} en los últimos 7 días`}
            />
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-8 lg:grid-cols-3 lg:items-start">
            <div className="min-w-0 space-y-8 lg:col-span-2">
              {!next ? (
                <EmptyState
                  icon={PartyPopper}
                  title="Bandeja al día"
                  description="No hay diseños pendientes ni cambios por hacer. Lo nuevo aparece acá apenas entra."
                />
              ) : (
                <>
                  <HomeSection id="home-next" title="Siguiente diseño" description="Lo que conviene hacer ahora.">
                    <NextUp entry={next} now={now} onOpen={() => setOpenOrderId(next.item.id)} />
                  </HomeSection>

                  <HomeSection
                    id="home-queue"
                    title="Tu bandeja por prioridad"
                    count={prioritized.length}
                    description="Primero lo vencido y lo que volvió con cambios; después lo nuevo sin abrir."
                    action={{ label: "Tareas asignadas", href: "/dashboard/tareas" }}
                  >
                    <div className="space-y-5">
                      {groups.map((group) => (
                        <div key={group.priority} className="space-y-2">
                          <h3 className="flex items-center gap-2 text-sm font-medium">
                            {PRIORITY_LABEL[group.priority]}
                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                              {group.items.length}
                            </span>
                          </h3>
                          <Panel>
                            <ul className="divide-y divide-border/60">
                              {group.items.map(({ item, priority }) => (
                                <li key={item.key} className="flex items-center gap-3 px-4 py-3">
                                  <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                                    <span className="w-fit shrink-0">
                                      <PriorityPill priority={priority} />
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setOpenOrderId(item.id)}
                                      className="min-w-0 flex-1 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                                      aria-label={`Ver pedido #${item.id} de ${item.clientName}`}
                                    >
                                      <span className="block truncate text-sm font-medium">{productsLine(item.products)}</span>
                                      <Meta item={item} now={now} />
                                    </button>
                                  </div>
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="shrink-0"
                                    variant={priority === "overdue" || priority === "changes" ? "default" : "outline"}
                                    onClick={() => setOpenOrderId(item.id)}
                                  >
                                    {actionLabel(item)}
                                  </Button>
                                </li>
                              ))}
                            </ul>
                          </Panel>
                        </div>
                      ))}
                    </div>
                  </HomeSection>
                </>
              )}
            </div>

            <div className="min-w-0 space-y-8">
              <HomeSection
                id="home-waiting"
                title="Esperando al cliente"
                count={data.counters.waitingClient}
                description="Montajes enviados; Recepción confirma la autorización."
              >
                {data.waitingClient.length === 0 ? (
                  <Panel className="px-4 py-4 text-sm text-muted-foreground">Ningún montaje esperando respuesta.</Panel>
                ) : (
                  <Panel>
                    <ul className="divide-y divide-border/60">
                      {data.waitingClient.map((item) => (
                        <li key={item.key}>
                          <button
                            type="button"
                            onClick={() => setOpenOrderId(item.id)}
                            className="block w-full px-4 py-2.5 text-left hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                          >
                            <span className="block truncate text-sm font-medium">
                              #{item.id} · {item.clientName}
                            </span>
                            <span className="block truncate text-meta">
                              Ronda {item.round || 1} enviada {relativeTo(item.lastSentAt ?? item.availableSince, now)} ·{" "}
                              {dueText(item.deliveryDate, now)}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </Panel>
                )}
              </HomeSection>

              <HomeSection id="home-team" title="Equipo" description="Diseños activos por persona.">
                {data.team.length === 0 ? (
                  <Panel className="px-4 py-4 text-sm text-muted-foreground">Sin diseños activos.</Panel>
                ) : (
                  <Panel>
                    <ul className="divide-y divide-border/60">
                      {data.team.map((row) => (
                        <li key={row.userId ?? "free"} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                          <span className={cn("truncate", row.userId === null && "text-muted-foreground")}>{row.name}</span>
                          <span className="shrink-0 text-meta tabular-nums">
                            {row.active} activo{row.active === 1 ? "" : "s"} · {row.inProgress} empezado{row.inProgress === 1 ? "" : "s"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Panel>
                )}
              </HomeSection>

              <HomeSection id="home-rounds" title="Rondas de montaje">
                <Panel className="space-y-1 px-4 py-3 text-sm">
                  <p>
                    {data.rounds.avgToApproval !== null ? (
                      <>
                        <span className="font-heading text-lg font-semibold tabular-nums">
                          {data.rounds.avgToApproval.toLocaleString("es-MX")}
                        </span>{" "}
                        rondas en promedio hasta autorizar
                      </>
                    ) : (
                      "Todavía sin autorizaciones en los últimos 30 días"
                    )}
                  </p>
                  <p className="text-meta">
                    {data.rounds.approvedLast30} autorizados en 30 días
                    {data.rounds.manyRounds > 0 ? ` · ${data.rounds.manyRounds} activos con 3 rondas o más` : ""}
                  </p>
                </Panel>
              </HomeSection>

              <HomeSection id="home-notices" title="Avisos" action={{ label: "Todos", href: "/dashboard/notificaciones" }}>
                <Panel>
                  <RecentNotices limit={5} />
                </Panel>
              </HomeSection>
            </div>
          </div>
        </>
      )}

      <OrderDetailDialog orderId={openOrderId} onClose={() => setOpenOrderId(null)} />
    </div>
  );
}
