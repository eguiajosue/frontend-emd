"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { AlarmClock, CalendarClock, Clock3, Hourglass, RefreshCw, UserX, Users } from "lucide-react";
import Title from "@/components/Title";
import { AreaChip } from "@/components/AreaChip";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ErrorState } from "@/components/feedback/states";
import { usePermissions } from "@/hooks/usePermissions";
import { useCoordination, useSetDelayReason } from "@/hooks/useCoordination";
import { getAreaLabel } from "@/lib/areas";
import {
  DELAY_REASONS,
  areaStageLabel,
  formatHours,
  stuckAt,
  type AreaLoad,
  type CoordinationOverview,
  type DelayReason,
  type OverdueOrder,
} from "@/lib/coordination";
import { cn } from "@/lib/utils";

const NO_REASON = "__sin_motivo";

function SectionTitle({ id, icon: Icon, children, aside }: { id: string; icon: typeof Clock3; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <h2 id={id} className="flex items-center gap-2 text-section-title">
        <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
        {children}
      </h2>
      {aside}
    </div>
  );
}

/** Motivo del atraso: se guarda al elegirlo; la nota, al salir del campo o con Enter. */
function DelayReasonEditor({ order }: { order: OverdueOrder }) {
  const setReason = useSetDelayReason();
  const [note, setNote] = useState(order.note ?? "");
  const save = (reason: DelayReason | null, nextNote = note) =>
    setReason.mutate({ orderId: order.id, reason, note: nextNote || undefined });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={order.reason ?? NO_REASON}
        onValueChange={(v) => save(v === NO_REASON ? null : (v as DelayReason))}
        disabled={setReason.isPending}
      >
        <SelectTrigger
          className={cn("h-9 w-48", !order.reason && "border-dashed text-muted-foreground")}
          aria-label={`Motivo del atraso del pedido #${order.id}`}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_REASON}>Sin motivo</SelectItem>
          {DELAY_REASONS.map((r) => (
            <SelectItem key={r.value} value={r.value}>
              {r.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {order.reason && (
        <Input
          value={note}
          maxLength={300}
          placeholder="Detalle (opcional)"
          aria-label={`Detalle del atraso del pedido #${order.id}`}
          className="h-9 min-w-[10rem] flex-1"
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => note !== (order.note ?? "") && save(order.reason, note)}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        />
      )}
    </div>
  );
}

function OverdueList({ orders, onOpen }: { orders: OverdueOrder[]; onOpen: (id: number) => void }) {
  if (orders.length === 0) {
    return (
      <Card className="border-dashed p-6 text-center text-sm text-muted-foreground">Ningún pedido atrasado. 🎉</Card>
    );
  }
  const withoutReason = orders.filter((o) => !o.reason).length;
  return (
    <div className="space-y-3">
      {withoutReason > 0 && (
        <p className="text-sm text-muted-foreground">
          {withoutReason} sin motivo registrado: anotarlo ayuda a ver qué se repite.
        </p>
      )}
      <ul className="space-y-2">
        {orders.map((o) => (
          <li key={o.id}>
            <Card className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-red-500/12 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-red-700 dark:bg-red-400/15 dark:text-red-300">
                    {o.daysLate} día{o.daysLate === 1 ? "" : "s"} tarde
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpen(o.id)}
                    className="truncate text-left font-semibold hover:underline"
                  >
                    <span className="tabular-nums text-muted-foreground">#{o.id}</span> {o.clientName ?? o.description}
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                  {o.areas.filter((a) => a.status !== "terminado").length === 0 ? (
                    <span>{stuckAt(o)}</span>
                  ) : (
                    o.areas
                      .filter((a) => a.status !== "terminado")
                      .map((a) => (
                        <span key={a.area} className="inline-flex items-center gap-1.5">
                          <AreaChip area={a.area} />
                          {areaStageLabel(a)}
                        </span>
                      ))
                  )}
                </div>
              </div>
              <DelayReasonEditor key={`${o.id}-${o.reasonAt ?? ""}`} order={o} />
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <p className={cn("font-heading text-2xl font-semibold tabular-nums leading-none", value === 0 ? "text-muted-foreground/60" : tone)}>
        {value}
      </p>
      <p className="mt-1 truncate text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function AreaLoadCard({ load, max }: { load: AreaLoad; max: number }) {
  const open = load.pendiente + load.enProceso;
  return (
    <Card data-area={load.area} className="space-y-4 overflow-hidden p-0">
      <div className="area-band flex items-center justify-between px-4 py-3">
        <span className="font-semibold">{getAreaLabel(load.area)}</span>
        <span className="text-sm tabular-nums text-muted-foreground">{open} abiertas</span>
      </div>
      <div className="space-y-4 px-4 pb-4">
        <div className="grid grid-cols-4 gap-2">
          <Stat value={load.pendiente} label="Sin empezar" />
          <Stat value={load.enProceso} label="En proceso" />
          <Stat value={load.atrasadas} label="Atrasadas" tone="text-red-600 dark:text-red-400" />
          <Stat value={load.pronto} label="Hoy / mañana" tone="text-amber-600 dark:text-amber-400" />
        </div>
        {/* Barra relativa a la más cargada: de un vistazo, quién está saturado. */}
        <div className="h-2 overflow-hidden rounded-full bg-muted" role="presentation">
          <div className="h-full rounded-full bg-[hsl(var(--tone))]" style={{ width: `${max ? (open / max) * 100 : 0}%` }} />
        </div>
        {load.people.length > 0 || load.sinPersona > 0 ? (
          <ul className="space-y-1.5 text-sm" aria-label={`Carga por persona en ${getAreaLabel(load.area)}`}>
            {load.people.map((p) => (
              <li key={p.userId} className="flex items-center justify-between gap-2">
                <span className="truncate">{p.name}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {p.pendiente + p.enProceso}
                  {p.atrasadas > 0 && <span className="ml-1.5 text-red-600 dark:text-red-400">· {p.atrasadas} tarde</span>}
                </span>
              </li>
            ))}
            {load.sinPersona > 0 && (
              <li className="flex items-center justify-between gap-2 text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <UserX className="h-3.5 w-3.5" aria-hidden />
                  Sin tomar (cuenta del área)
                </span>
                <span className="tabular-nums">{load.sinPersona}</span>
              </li>
            )}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Sin trabajo abierto.</p>
        )}
      </div>
    </Card>
  );
}

function StageTimes({ data }: { data: CoordinationOverview["stageTimes"] }) {
  const rows = [
    ...data.stages.map((s) => ({ key: s.key, label: s.label, area: null as string | null, s })),
    ...data.areas.flatMap((a) => [
      { key: `${a.area}-espera`, label: "Espera para empezar", area: a.area, s: a.espera },
      { key: `${a.area}-produccion`, label: "Producción", area: a.area, s: a.produccion },
    ]),
  ].filter((r) => r.s.count > 0 || r.area == null);
  const max = Math.max(1, ...rows.map((r) => r.s.p75Hours ?? 0));
  return (
    <Card className="divide-y divide-border/60 p-0">
      {rows.map((r) => (
        <div key={r.key} className="grid grid-cols-[minmax(0,17rem)_1fr_auto] items-center gap-4 px-4 py-3">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm">
            {r.area && <AreaChip area={r.area} />}
            <span className="truncate">{r.label}</span>
          </div>
          <div className="relative h-2.5 rounded-full bg-muted" data-area={r.area ?? undefined} role="presentation">
            {r.s.p75Hours != null && (
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-[hsl(var(--tone,240_6%_60%)/0.35)]"
                style={{ width: `${(r.s.p75Hours / max) * 100}%` }}
              />
            )}
            {r.s.medianHours != null && (
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-[hsl(var(--tone,240_31%_15%))] dark:bg-[hsl(var(--tone,240_6%_80%))]"
                style={{ width: `${(r.s.medianHours / max) * 100}%` }}
              />
            )}
          </div>
          <div className="text-right text-sm tabular-nums">
            <span className="font-semibold">{formatHours(r.s.medianHours)}</span>
            <span className="text-muted-foreground"> · {r.s.count} {r.s.count === 1 ? "caso" : "casos"}</span>
          </div>
        </div>
      ))}
      <p className="px-4 py-2.5 text-xs text-muted-foreground">
        Barra intensa: lo típico (mediana). Barra tenue: 3 de cada 4 casos tardan menos que eso. Últimos {data.windowDays} días.
      </p>
    </Card>
  );
}

/**
 * Coordinación: la vista de Recepción para saber qué área está saturada,
 * cuánto tarda cada etapa y qué pedidos van tarde (y por qué).
 */
export default function CoordinacionPage() {
  const router = useRouter();
  const { canManageOperations, isSessionLoading: sessionLoading } = usePermissions();
  const { data, isPending, isError, refetch, isFetching } = useCoordination();

  if (!sessionLoading && !canManageOperations) {
    return <Card className="mt-10 border-dashed p-10 text-center text-sm text-muted-foreground">No tienes permiso para ver esta página.</Card>;
  }

  const maxLoad = data ? Math.max(1, ...data.load.map((l) => l.pendiente + l.enProceso)) : 1;
  const totals = data?.load.reduce(
    (acc, l) => ({ open: acc.open + l.pendiente + l.enProceso, late: acc.late + l.atrasadas, soon: acc.soon + l.pronto }),
    { open: 0, late: 0, soon: 0 }
  );

  return (
    <div className="space-y-8">
      <Title title="Coordinación" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {data
            ? `${totals!.open} tareas abiertas · ${data.overdue.length} pedidos atrasados · ${totals!.soon} tareas para hoy o mañana`
            : "Carga por área, tiempos por etapa y pedidos atrasados."}
        </p>
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => void refetch()} disabled={isFetching}>
          <RefreshCw className={cn("h-4 w-4", isFetching && "motion-safe:animate-spin")} aria-hidden />
          {data ? `Actualizado ${formatDistanceToNow(new Date(data.generatedAt), { locale: es, addSuffix: true })}` : "Actualizar"}
        </Button>
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isPending || !data ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : (
        <>
          <section aria-labelledby="coord-atrasados" className="space-y-3">
            <SectionTitle id="coord-atrasados" icon={AlarmClock} aside={<span className="text-sm tabular-nums text-muted-foreground">{data.overdue.length}</span>}>
              Pedidos atrasados
            </SectionTitle>
            <OverdueList orders={data.overdue} onOpen={(id) => router.push(`/dashboard/orders/${id}`)} />
          </section>

          <section aria-labelledby="coord-carga" className="space-y-3">
            <SectionTitle id="coord-carga" icon={Users}>
              Carga por área y persona
            </SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {data.load.map((l) => (
                <AreaLoadCard key={l.area} load={l} max={maxLoad} />
              ))}
            </div>
          </section>

          <section aria-labelledby="coord-tiempos" className="space-y-3">
            <SectionTitle id="coord-tiempos" icon={Hourglass} aside={<CalendarClock className="h-4 w-4 text-muted-foreground" aria-hidden />}>
              Tiempos por etapa
            </SectionTitle>
            <StageTimes data={data.stageTimes} />
          </section>
        </>
      )}
    </div>
  );
}
