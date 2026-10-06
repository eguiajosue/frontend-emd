"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  CalendarDays,
  CheckCircle2,
  CircleCheckBig,
  Flame,
  Hourglass,
  Inbox,
  Loader2,
  PartyPopper,
  Play,
  Timer,
  Workflow,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { GreetingHeader } from "@/components/admin/GreetingHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/feedback/states";
import { OrderDetailDialog } from "@/components/orders/OrderDetailDialog";
import { useProductionDashboard } from "@/hooks/useDashboard";
import { useAdvanceMyTask } from "@/hooks/useMyTasks";
import { useNow } from "@/hooks/useNow";
import { getAreaIcon, getAreaLabel } from "@/lib/areas";
import { formatRoleList } from "@/lib/roles";
import {
  PRIORITY_LABEL,
  dueText,
  groupByPriority,
  prioritizeProduction,
  relativeTo,
  type Prioritized,
} from "@/lib/homeDashboard";
import { cn } from "@/lib/utils";
import type { AreaTaskStatus, MyTask, ProductionWorkItem } from "@/types";
import { HomeSection, LiveStatus, Panel, PriorityPill, RecentNotices, StatTile, productsLine } from "./HomeShared";

/** La bandeja avanza tareas con el mismo hook que "Tareas asignadas". */
function toMyTask(item: ProductionWorkItem): MyTask {
  return {
    key: item.key,
    kind: "production",
    area: item.area,
    taskId: item.taskId,
    status: item.status,
    mine: item.mine,
    assignee: item.assignee
      ? { id: item.assignee.id, firstName: item.assignee.name, lastName: null, username: item.assignee.name }
      : null,
    startedAt: item.startedAt,
    order: {
      id: item.id,
      description: item.description,
      deliveryDate: item.deliveryDate,
      creationDate: item.creationDate,
      statusId: 0,
      clientNameOverride: item.clientName,
      designStartedAt: null,
      designStartedByName: null,
      client: null,
      status: { id: 0, name: item.statusName },
    },
  };
}

function actionFor(item: ProductionWorkItem): { label: string; next: AreaTaskStatus; icon: typeof Play } {
  if (item.status === "en_proceso") return { label: "Terminar", next: "terminado", icon: CheckCircle2 };
  return { label: item.mine ? "Empezar" : "Tomar y empezar", next: "en_proceso", icon: Play };
}

function whoLine(item: ProductionWorkItem): string {
  if (item.mine) return "Tuyo";
  return item.assignee ? item.assignee.name : "Libre para tomar";
}

/** El trabajo que conviene hacer ahora, grande y con su acción. */
function NextUp({
  entry,
  now,
  busy,
  onAdvance,
  onOpen,
}: {
  entry: Prioritized<ProductionWorkItem>;
  now: number;
  busy: boolean;
  onAdvance: () => void;
  onOpen: () => void;
}) {
  const { item, priority } = entry;
  const action = actionFor(item);
  const ActionIcon = action.icon;
  const AreaIcon = getAreaIcon(item.area);
  return (
    <Panel className="space-y-4 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <PriorityPill priority={priority} />
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-foreground/80">
          {AreaIcon && <AreaIcon className="h-3.5 w-3.5" aria-hidden />}
          {getAreaLabel(item.area)}
        </span>
        <span className="text-meta">{whoLine(item)}</span>
      </div>
      <div className="min-w-0 space-y-1">
        <p className="font-heading text-xl font-semibold leading-snug">{productsLine(item.products)}</p>
        <p className="truncate text-sm text-muted-foreground">
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
        {dueText(item.deliveryDate, now)}
        {item.status === "pendiente" && (
          <span className="font-normal text-muted-foreground"> · espera desde {relativeTo(item.availableSince, now)}</span>
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="lg" className="gap-2" onClick={onAdvance} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ActionIcon className="h-4 w-4" />}
          {action.label}
        </Button>
        <Button type="button" size="lg" variant="outline" onClick={onOpen}>
          Ver pedido
        </Button>
      </div>
    </Panel>
  );
}

function SideList({ children }: { children: ReactNode }) {
  return (
    <Panel>
      <ul className="divide-y divide-border/60">{children}</ul>
    </Panel>
  );
}

/**
 * Inicio de Producción: los trabajos de sus áreas en el orden en que
 * conviene hacerlos (lo que está por caducar y lo que nadie empezó, primero),
 * el siguiente destacado con su acción, y al costado los avisos, lo que llega
 * de Diseño, la agenda y el stock bajo de su área.
 */
export function ProductionHome({
  firstName,
  roles,
  switcher,
}: {
  firstName?: string | null;
  roles: string[];
  switcher?: ReactNode;
}) {
  const { data, isLoading, isError, isFetching, updatedAt, refetch } = useProductionDashboard();
  const { advance, pendingKey } = useAdvanceMyTask();
  const now = useNow(60_000);
  const [openOrderId, setOpenOrderId] = useState<number | null>(null);

  const prioritized = useMemo(() => (data ? prioritizeProduction(data.items, now) : []), [data, now]);
  const groups = useMemo(() => groupByPriority(prioritized), [prioritized]);
  const next = prioritized[0];
  const areasLabel = data ? formatRoleList(data.areas) : formatRoleList(roles);

  const subtitle = data
    ? `${areasLabel}: ${data.counters.notStarted} sin empezar · ${data.counters.inProgress} en curso${
        data.counters.overdue ? ` · ${data.counters.overdue} vencido${data.counters.overdue === 1 ? "" : "s"}` : ""
      }.`
    : `Tu trabajo en ${areasLabel}, por prioridad.`;

  const run = (item: ProductionWorkItem) => advance(toMyTask(item), actionFor(item).next);

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <GreetingHeader firstName={firstName} subtitle={subtitle} />
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
            <StatTile icon={Flame} label="Vencidos" value={data.counters.overdue} tone="danger" />
            <StatTile icon={Hourglass} label="Por vencer" value={data.counters.atRisk} tone="warn" hint="en las próximas 48 h" />
            <StatTile icon={Inbox} label="Sin empezar" value={data.counters.notStarted} tone="warn" hint="tuyos y libres" />
            <StatTile icon={Timer} label="En curso" value={data.counters.inProgress} tone="info" />
            <StatTile icon={CircleCheckBig} label="Terminadas hoy" value={data.counters.doneToday} tone="good" hint="en tu área" />
            <StatTile icon={Workflow} label="Llegan de Diseño" value={data.counters.upcoming} hint="planificados para tu área" />
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-8 lg:grid-cols-3 lg:items-start">
            <div className="min-w-0 space-y-8 lg:col-span-2">
              {!next ? (
                <EmptyState
                  icon={PartyPopper}
                  title="Sin trabajos pendientes"
                  description="Cuando entre trabajo nuevo a tu área aparece aquí, ordenado por prioridad."
                />
              ) : (
                <>
                  <HomeSection id="home-next" title="Siguiente trabajo">
                    <NextUp
                      entry={next}
                      now={now}
                      busy={pendingKey === next.item.key}
                      onAdvance={() => run(next.item)}
                      onOpen={() => setOpenOrderId(next.item.id)}
                    />
                  </HomeSection>

                  <HomeSection
                    id="home-queue"
                    title="Tu lista por prioridad"
                    count={prioritized.length}
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
                              {group.items.map(({ item, priority }) => {
                                const action = actionFor(item);
                                const ActionIcon = action.icon;
                                const busy = pendingKey === item.key;
                                const AreaIcon = getAreaIcon(item.area);
                                return (
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
                                        <span className="block truncate text-meta">
                                          <span className="tabular-nums">#{item.id}</span> · {item.clientName} ·{" "}
                                          {AreaIcon && <AreaIcon className="inline h-3 w-3 align-[-1px]" aria-hidden />} {getAreaLabel(item.area)} ·{" "}
                                          {dueText(item.deliveryDate, now)} · {whoLine(item)}
                                        </span>
                                      </button>
                                    </div>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant={item.status === "en_proceso" ? "default" : "outline"}
                                      className="shrink-0 gap-1.5"
                                      onClick={() => run(item)}
                                      disabled={busy}
                                      aria-label={`${action.label}: pedido #${item.id}`}
                                    >
                                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ActionIcon className="h-3.5 w-3.5" />}
                                      {action.label}
                                    </Button>
                                  </li>
                                );
                              })}
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
              <HomeSection id="home-notices" title="Avisos" action={{ label: "Todos", href: "/dashboard/notificaciones" }}>
                <Panel>
                  <RecentNotices limit={5} />
                </Panel>
              </HomeSection>

              {data.events.length > 0 && (
                <HomeSection id="home-events" title="Hoy y mañana" count={data.events.length}>
                  <SideList>
                    {data.events.map((event) => (
                      <li key={event.id} className="flex items-start gap-3 px-4 py-2.5">
                        <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{event.title}</p>
                          <p className="truncate text-meta">
                            {format(new Date(event.eventDate), event.hasTime ? "EEE d · HH:mm" : "EEE d", { locale: es })}
                            {event.clientName ? ` · ${event.clientName}` : ""}
                            {event.area ? ` · ${getAreaLabel(event.area)}` : ""}
                          </p>
                        </div>
                      </li>
                    ))}
                  </SideList>
                </HomeSection>
              )}

              <HomeSection id="home-upcoming" title="Llegan de Diseño" count={data.counters.upcoming}>
                {data.upcoming.length === 0 ? (
                  <Panel className="px-4 py-4 text-sm text-muted-foreground">Nada planificado por ahora.</Panel>
                ) : (
                  <SideList>
                    {data.upcoming.map((order) => (
                      <li key={`${order.id}-${order.area}`}>
                        <button
                          type="button"
                          onClick={() => setOpenOrderId(order.id)}
                          className="block w-full px-4 py-2.5 text-left hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                        >
                          <span className="block truncate text-sm font-medium">{productsLine(order.products)}</span>
                          <span className="block truncate text-meta">
                            #{order.id} · {order.clientName} · {order.designStatus} · {dueText(order.deliveryDate, now)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </SideList>
                )}
              </HomeSection>

              {data.team.length > 0 && (
                <HomeSection id="home-team" title="En el área ahora">
                  <SideList>
                    {data.team.map((person) => (
                      <li key={person.name} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                        <span className="truncate">{person.name}</span>
                        <span className="shrink-0 text-meta">{person.inProgress} en curso</span>
                      </li>
                    ))}
                  </SideList>
                </HomeSection>
              )}
            </div>
          </div>
        </>
      )}

      <OrderDetailDialog orderId={openOrderId} onClose={() => setOpenOrderId(null)} />
    </div>
  );
}
