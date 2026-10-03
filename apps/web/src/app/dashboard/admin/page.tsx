"use client";

import { formatOrderCode } from "@/lib/orderCode";
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { staggerContainerVariants, staggerItemVariants } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/data-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ColumnDef } from "@tanstack/react-table";
import { ErrorState } from "@/components/feedback/states";
import { useOrderHistories, useOrders } from "@/hooks/useOrders";
import { usePermissions } from "@/hooks/usePermissions";
import { statusMap } from "@/lib/orderStatus";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate, formatDeliveryDate, getClientName, getUserName } from "@/lib/format";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import type { Order, OrderHistory } from "@/types";
import {
  AlarmClock,
  AlertTriangle,
  CircleCheck,
  CircleDashed,
  CircleX,
  Gauge,
  LayoutDashboard,
  ListChecks,
  PackageCheck,
  ShieldAlert,
  Timer,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { GreetingHeader } from "@/components/admin/GreetingHeader";
import { DeliveryCalendar } from "@/components/admin/DeliveryCalendar";
import { UpcomingDeliveries } from "@/components/admin/UpcomingDeliveries";
import { OrderDetailDialog } from "@/components/orders/OrderDetailDialog";
import { ChartDrillDownPanel } from "@/components/charts/ChartDrillDownPanel";
import { isOverdue } from "@/lib/deliveryProgress";

const HOUR_MS = 60 * 60 * 1000;
const FALLBACK_THRESHOLD_HOURS = 60; // umbral fijo (48-72h) usado cuando no hay histórico suficiente
const MIN_SAMPLES_FOR_AVERAGE = 3;
const STAGNATION_MULTIPLIER = 1.5;

// Reglas de sugerencia por etapa (según los nombres reales del sistema, ver src/lib/orderStatus.ts)
const SUGGESTIONS_BY_STATUS: { [key: number]: string } = {
  1: "Verificar si faltan datos del cliente o confirmación de pago para avanzar el pedido.",
  2: "Revisar resultados de pruebas de calidad; puede haber piezas rechazadas esperando reproceso.",
  3: "Revisar carga de trabajo del área de taller/producción; posible cuello de botella de personal o materiales.",
  4: "Confirmar con el cliente la logística de entrega y coordinar con el área de despacho.",
  5: "El pedido ya fue entregado; validar que el estado se haya registrado correctamente.",
};

const DEFAULT_SUGGESTION =
  "Revisar manualmente el pedido; no hay una regla específica para esta etapa.";

function formatDuration(ms: number) {
  if (ms < 0) ms = 0;
  const totalHours = ms / HOUR_MS;
  if (totalHours < 24) {
    return `${totalHours.toFixed(1)} h`;
  }
  const days = Math.floor(totalHours / 24);
  const hours = Math.round(totalHours % 24);
  return `${days}d ${hours}h`;
}

// Ícono de cada etapa en su tarjeta "carpeta" (ids de statusMap).
const STAGE_ICONS: { [statusId: number]: LucideIcon } = {
  1: CircleDashed,
  3: Timer,
  4: CircleCheck,
  5: PackageCheck,
  10: CircleX,
};

/** Puntualidad de una etapa: píldora con el color semántico al ~10%. */
function OnTimePill({ pct }: { pct: number | null }) {
  const tone =
    pct == null
      ? "bg-muted text-muted-foreground"
      : pct >= 80
      ? "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"
      : pct >= 50
      ? "bg-amber-500/10 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300"
      : "bg-red-500/10 text-red-700 dark:bg-red-400/10 dark:text-red-300";
  return (
    <span
      className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums", tone)}
      title="Pedidos de esta etapa que no están estancados"
    >
      {pct != null ? `${pct}% a tiempo` : "Sin pedidos"}
    </span>
  );
}

// recharts es pesado y no crítico para el primer render del panel admin.
const AvgTimeBarChart = dynamic(() => import("@/components/charts/AvgTimeBarChart"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

const AdminDashboardPage = () => {
  const { roles, isAdmin, isSessionLoading, session } = usePermissions();
  const { timeFormat } = useTimeFormat();
  const {
    data: orders,
    isPending: loadingOrders,
    isError: ordersError,
    refetch: refetchOrders,
  } = useOrders();
  const {
    data: histories,
    isPending: loadingHistories,
    isError: historiesError,
    refetch: refetchHistories,
  } = useOrderHistories();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("timeInStatus");
  const [openOrderId, setOpenOrderId] = useState<number | null>(null);
  const [activeEtapa, setActiveEtapa] = useState<string | null>(null);

  const loading = loadingOrders || loadingHistories || isSessionLoading;
  const hasError = ordersError || historiesError;

  // Última fecha de cambio de estado por pedido (o creationDate si nunca cambió)
  const lastChangeByOrder = useMemo(() => {
    const map = new Map<number, string>();
    histories.forEach((h) => {
      const current = map.get(h.orderId);
      if (!current || new Date(h.changeDate).getTime() > new Date(current).getTime()) {
        map.set(h.orderId, h.changeDate);
      }
    });
    return map;
  }, [histories]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const now = useMemo(() => Date.now(), [orders, histories]);

  const enrichedOrders = useMemo(() => {
    return orders.map((order) => {
      const lastChange = lastChangeByOrder.get(order.id) || order.creationDate;
      const timeInStatusMs = now - new Date(lastChange).getTime();
      return { order, lastChange, timeInStatusMs };
    });
  }, [orders, lastChangeByOrder, now]);

  // Tiempo promedio histórico por etapa: para cada OrderHistory (transición saliente de un estado),
  // el tiempo transcurrido entre el momento en que el pedido ENTRÓ a ese estado y el changeDate
  // (momento en que salió de él).
  const avgTimeByStatus = useMemo(() => {
    // Para cada pedido, ordenar sus historiales cronológicamente para saber cuándo entró a cada estado.
    const byOrder = new Map<number, OrderHistory[]>();
    histories.forEach((h) => {
      const list = byOrder.get(h.orderId) || [];
      list.push(h);
      byOrder.set(h.orderId, list);
    });

    const durations: { [statusId: number]: number[] } = {};

    byOrder.forEach((list, orderId) => {
      const sorted = [...list].sort(
        (a, b) => new Date(a.changeDate).getTime() - new Date(b.changeDate).getTime()
      );
      const order = orders.find((o) => o.id === orderId);
      let enteredAt = order?.creationDate;

      sorted.forEach((h) => {
        const statusLeft = h.previousStatusId;
        const enteredAtDate = enteredAt ? new Date(enteredAt).getTime() : undefined;
        const leftAtDate = new Date(h.changeDate).getTime();
        if (enteredAtDate !== undefined && statusLeft != null) {
          const duration = leftAtDate - enteredAtDate;
          if (duration >= 0) {
            durations[statusLeft] = durations[statusLeft] || [];
            durations[statusLeft].push(duration);
          }
        }
        enteredAt = h.changeDate;
      });
    });

    const averages: { [statusId: number]: { avgMs: number; samples: number } } = {};
    Object.entries(durations).forEach(([statusId, list]) => {
      const sum = list.reduce((a, b) => a + b, 0);
      averages[Number(statusId)] = { avgMs: sum / list.length, samples: list.length };
    });
    return averages;
  }, [histories, orders]);

  function getThresholdMs(statusId: number) {
    const stat = avgTimeByStatus[statusId];
    if (stat && stat.samples >= MIN_SAMPLES_FOR_AVERAGE) {
      return { thresholdMs: stat.avgMs * STAGNATION_MULTIPLIER, basedOnAverage: true };
    }
    return { thresholdMs: FALLBACK_THRESHOLD_HOURS * HOUR_MS, basedOnAverage: false };
  }

  function buildSuggestion(statusId: number, timeInStatusMs: number, thresholdMs: number) {
    const base = SUGGESTIONS_BY_STATUS[statusId] || DEFAULT_SUGGESTION;
    if (timeInStatusMs > thresholdMs * 2) {
      return `${base} Prioridad alta: contactar al responsable del área directamente.`;
    }
    return base;
  }

  const stagnantOrders = useMemo(() => {
    return enrichedOrders
      .map(({ order, timeInStatusMs }) => {
        const { thresholdMs, basedOnAverage } = getThresholdMs(order.statusId);
        const isStagnant = timeInStatusMs > thresholdMs;
        return { order, timeInStatusMs, thresholdMs, basedOnAverage, isStagnant };
      })
      .filter((entry) => entry.isStagnant)
      .sort((a, b) => b.timeInStatusMs - a.timeInStatusMs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrichedOrders, avgTimeByStatus]);

  const stagnantOrderIds = useMemo(
    () => new Set(stagnantOrders.map((s) => s.order.id)),
    [stagnantOrders]
  );

  const filteredSortedOrders = useMemo(() => {
    let list = enrichedOrders;
    if (statusFilter !== "all") {
      list = list.filter((e) => e.order.statusId === Number(statusFilter));
    }
    const sorted = [...list];
    switch (sortBy) {
      case "timeInStatus":
        sorted.sort((a, b) => b.timeInStatusMs - a.timeInStatusMs);
        break;
      case "creationDate":
        sorted.sort(
          (a, b) => new Date(b.order.creationDate).getTime() - new Date(a.order.creationDate).getTime()
        );
        break;
      case "deliveryDate":
        sorted.sort((a, b) => {
          const aD = a.order.deliveryDate ? new Date(a.order.deliveryDate).getTime() : Infinity;
          const bD = b.order.deliveryDate ? new Date(b.order.deliveryDate).getTime() : Infinity;
          return aD - bD;
        });
        break;
      case "status":
        sorted.sort((a, b) => a.order.statusId - b.order.statusId);
        break;
      default:
        break;
    }
    return sorted;
  }, [enrichedOrders, statusFilter, sortBy]);

  // Rendimiento por área/etapa
  const performanceByStatus = useMemo(() => {
    return Object.entries(statusMap).map(([idStr, label]) => {
      const statusId = Number(idStr);
      const currentCount = enrichedOrders.filter((e) => e.order.statusId === statusId).length;
      const stat = avgTimeByStatus[statusId];
      const avgMs = stat?.avgMs ?? null;
      const samples = stat?.samples ?? 0;
      const { thresholdMs } = getThresholdMs(statusId);
      const stagnantCount = enrichedOrders.filter(
        (e) => e.order.statusId === statusId && e.timeInStatusMs > thresholdMs
      ).length;
      const onTimePct =
        currentCount > 0
          ? Math.round(((currentCount - stagnantCount) / currentCount) * 100)
          : null;
      return {
        statusId,
        label: label.charAt(0).toUpperCase() + label.slice(1),
        currentCount,
        avgMs,
        samples,
        stagnantCount,
        onTimePct,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrichedOrders, avgTimeByStatus]);

  const chartData = useMemo(
    () =>
      performanceByStatus.map((p) => ({
        etapa: p.label,
        horasPromedio: p.avgMs != null ? Number((p.avgMs / HOUR_MS).toFixed(1)) : 0,
      })),
    [performanceByStatus]
  );

  // Etapa (statusId) actualmente seleccionada en el drill-down del gráfico,
  // resuelta desde el label de la barra clickeada.
  const activeStatusId = useMemo(() => {
    if (!activeEtapa) return null;
    const found = performanceByStatus.find((p) => p.label === activeEtapa);
    return found?.statusId ?? null;
  }, [activeEtapa, performanceByStatus]);

  const etapaOrders = useMemo(() => {
    if (activeStatusId == null) return [];
    return enrichedOrders
      .filter((e) => e.order.statusId === activeStatusId)
      .sort((a, b) => b.timeInStatusMs - a.timeInStatusMs);
  }, [enrichedOrders, activeStatusId]);

  // Data storytelling: pedidos por vencer en las próximas 24h (a partir de
  // los pedidos ya cargados, no hardcodeado).
  const dueSoonCount = useMemo(() => {
    const in24h = now + 24 * HOUR_MS;
    return orders.filter((o) => {
      if (!o.deliveryDate || isOverdue(o.creationDate, o.deliveryDate)) return false;
      const delivery = new Date(o.deliveryDate).getTime();
      return delivery <= in24h;
    }).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, now]);

  // Data storytelling: etapa con el tiempo promedio más alto (posible cuello
  // de botella), calculada a partir del mismo resumen que alimenta el gráfico.
  const slowestStageInsight = useMemo(() => {
    const withAvg = performanceByStatus.filter((p) => p.avgMs != null);
    if (withAvg.length === 0) return null;
    return withAvg.reduce((max, p) => (p.avgMs! > max.avgMs! ? p : max));
  }, [performanceByStatus]);

  // KPI hero del bento grid: score global de rendimiento (pedidos a tiempo /
  // total, agregando todas las etapas). Es el número más importante del
  // panel, así que ocupa la caja más grande.
  const overallScore = useMemo(() => {
    const totalActive = enrichedOrders.length;
    const totalStagnant = stagnantOrders.length;
    const onTimePct =
      totalActive > 0 ? Math.round(((totalActive - totalStagnant) / totalActive) * 100) : null;
    return { totalActive, totalStagnant, onTimePct };
  }, [enrichedOrders, stagnantOrders]);

  type OrderRow = { order: Order; timeInStatusMs: number };

  const trackingColumns: ColumnDef<OrderRow>[] = [
    { id: "id", header: "ID", cell: ({ row }) => `${formatOrderCode(row.original.order.id)}` },
    {
      id: "client",
      header: "Cliente",
      cell: ({ row }) => getClientName(row.original.order.client),
    },
    {
      id: "creator",
      header: "Creado por",
      cell: ({ row }) => getUserName(row.original.order.user),
    },
    {
      id: "status",
      header: "Estado",
      cell: ({ row }) => (
        <StatusBadge
          statusId={row.original.order.statusId}
          statusName={row.original.order.status?.name}
        />
      ),
    },
    {
      id: "creationDate",
      header: "Fecha de Creación",
      cell: ({ row }) =>
        formatDate(row.original.order.creationDate),
    },
    {
      id: "deliveryDate",
      header: "Fecha de Entrega",
      cell: ({ row }) =>
        formatDeliveryDate(row.original.order.deliveryDate, timeFormat),
    },
    {
      id: "timeInStatus",
      header: "Tiempo en estado actual",
      cell: ({ row }) => {
        const isStagnant = stagnantOrderIds.has(row.original.order.id);
        return (
          isStagnant ? (
            <Badge
              variant="muted"
              className="bg-red-500/10 font-semibold tabular-nums text-red-700 dark:bg-red-400/10 dark:text-red-300"
            >
              <AlertTriangle className="h-3 w-3" aria-hidden />
              {formatDuration(row.original.timeInStatusMs)}
            </Badge>
          ) : (
            <span className="text-sm tabular-nums">{formatDuration(row.original.timeInStatusMs)}</span>
          )
        );
      },
    },
  ];

  const stagnantColumns: ColumnDef<(typeof stagnantOrders)[number]>[] = [
    { id: "id", header: "Pedido", cell: ({ row }) => `${formatOrderCode(row.original.order.id)}` },
    {
      id: "client",
      header: "Cliente",
      cell: ({ row }) => getClientName(row.original.order.client),
    },
    {
      id: "status",
      header: "Estado",
      cell: ({ row }) => (
        <StatusBadge
          statusId={row.original.order.statusId}
          statusName={row.original.order.status?.name}
        />
      ),
    },
    {
      id: "timeInStatus",
      header: "Tiempo estancado",
      cell: ({ row }) => (
        <span className="font-semibold tabular-nums text-red-700 dark:text-red-400">
          {formatDuration(row.original.timeInStatusMs)}
        </span>
      ),
    },
    {
      id: "suggestion",
      header: "Sugerencia",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {buildSuggestion(
            row.original.order.statusId,
            row.original.timeInStatusMs,
            row.original.thresholdMs
          )}
        </span>
      ),
    },
  ];

  if (roles.length > 0 && !isAdmin) {
    return (
      <Card className="mt-10 border-dashed p-10 text-center text-sm text-muted-foreground">
        No tienes permiso para ver esta página.
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <GreetingHeader firstName={session?.user?.first_name} />

      {hasError ? (
        <ErrorState
          onRetry={() => {
            refetchOrders();
            refetchHistories();
          }}
        />
      ) : loading ? (
        <div className="space-y-6">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-2xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Skeleton className="h-80 w-full rounded-2xl lg:col-span-2" />
            <Skeleton className="h-80 w-full rounded-2xl" />
          </div>
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={LayoutDashboard}
          title="El panel está esperando su primer pedido"
          description="Las métricas de rendimiento, tiempos por etapa y alertas van a aparecer acá apenas se cargue el primero."
        />
      ) : (
        <>
          {/* Banner del score global: el número más importante del panel,
              dicho en una frase, con el atajo a Rendimiento a la derecha. */}
          <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <span
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-[hsl(345_88%_60%)] text-primary-foreground"
                aria-hidden
              >
                <Gauge className="h-5 w-5" />
              </span>
              <p className="min-w-0 text-sm text-muted-foreground sm:text-[0.95rem]">
                <span className="font-semibold text-foreground">
                  {overallScore.onTimePct != null
                    ? `${overallScore.onTimePct}% de los pedidos activos va a tiempo.`
                    : "Todavía no hay pedidos activos para medir."}
                </span>{" "}
                Score de rendimiento general sobre {overallScore.totalActive} pedido
                {overallScore.totalActive === 1 ? "" : "s"}
                {overallScore.totalStagnant > 0 && (
                  <>
                    {" "}
                    ·{" "}
                    <span className="font-medium text-red-600 dark:text-red-400">
                      {overallScore.totalStagnant} estancado
                      {overallScore.totalStagnant === 1 ? "" : "s"}
                    </span>
                  </>
                )}
                .
              </p>
            </div>
            <Button variant="secondary" className="shrink-0 self-start sm:self-auto" asChild>
              <Link href="/dashboard/admin/rendimiento">
                <TrendingUp aria-hidden />
                Rendimiento de empleados y áreas
              </Link>
            </Button>
          </Card>

          {/* Una tarjeta "carpeta" por etapa + la de vencimientos próximos:
              ícono en círculo gris, número y etiqueta, y la puntualidad de la
              etapa como píldora tintada. */}
          <section className="space-y-4" aria-labelledby="rendimiento-etapas">
            <h2 id="rendimiento-etapas" className="text-section-title">
              Rendimiento por área/etapa
            </h2>
            <motion.div
              className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
              variants={staggerContainerVariants}
              initial="hidden"
              animate="show"
            >
              {performanceByStatus.map((p) => {
                const Icon = STAGE_ICONS[p.statusId] ?? ListChecks;
                return (
                  <motion.div key={p.statusId} variants={staggerItemVariants} className="min-w-0">
                    <Card className="flex h-full min-w-0 flex-col gap-4 p-5">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-muted" aria-hidden>
                          <Icon className="h-5 w-5 text-muted-foreground" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-heading text-lg font-semibold leading-tight tabular-nums">
                            {p.currentCount} pedido{p.currentCount === 1 ? "" : "s"}
                          </p>
                          <p className="truncate text-sm text-muted-foreground">{p.label}</p>
                        </div>
                        <OnTimePill pct={p.onTimePct} />
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                        <span>
                          Prom. histórico:{" "}
                          <span className="font-medium text-foreground">
                            {p.avgMs != null ? formatDuration(p.avgMs) : "sin datos"}
                          </span>
                          {p.samples > 0 && p.samples < MIN_SAMPLES_FOR_AVERAGE && " (poca muestra)"}
                        </span>
                        <span>
                          Estancados:{" "}
                          <span
                            className={cn(
                              "font-medium tabular-nums",
                              p.stagnantCount > 0 ? "text-red-600 dark:text-red-400" : "text-foreground"
                            )}
                          >
                            {p.stagnantCount}
                          </span>
                        </span>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
              <motion.div variants={staggerItemVariants} className="min-w-0">
                <Card className="flex h-full min-w-0 flex-col gap-4 p-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-muted" aria-hidden>
                      <AlarmClock className="h-5 w-5 text-muted-foreground" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-heading text-lg font-semibold leading-tight tabular-nums">
                        {dueSoonCount} pedido{dueSoonCount === 1 ? "" : "s"}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">Por vencer en 24 h</p>
                    </div>
                  </div>
                  <p className="border-t border-border/60 pt-3 text-xs text-muted-foreground">
                    Entregas de las próximas 24 horas que todavía no vencieron.
                  </p>
                </Card>
              </motion.div>
            </motion.div>
          </section>

          {/* `grid-cols-1` explícito: sin él, por debajo de `lg:` la única
              columna implícita se autoancha al max-content del contenido más
              ancho (el gráfico, la tabla de drill-down, las filas de
              "Próximas entregas") en vez de ocupar el 100% del contenedor —
              y como `<main>` recorta con `overflow-x-hidden`, ese sobreancho
              se vería como tarjetas cortadas a la derecha en mobile. */}
          <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
            <div className="min-w-0 space-y-8 lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Tiempo promedio por etapa (horas)</CardTitle>
                  {slowestStageInsight && (
                    <p className="text-sm text-muted-foreground">
                      La etapa{" "}
                      <span className="font-medium text-foreground">{slowestStageInsight.label}</span>{" "}
                      es la que más tiempo promedio toma ({formatDuration(slowestStageInsight.avgMs!)}).
                      {dueSoonCount > 0 && (
                        <> {dueSoonCount} pedido{dueSoonCount === 1 ? "" : "s"} por vencer en las próximas 24h.</>
                      )}
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="h-72 w-full">
                    <AvgTimeBarChart
                      data={chartData}
                      activeEtapa={activeEtapa}
                      onBarClick={(etapa) => setActiveEtapa((prev) => (prev === etapa ? null : etapa))}
                    />
                  </div>
                  <ChartDrillDownPanel
                    activeKey={activeEtapa}
                    title={`Pedidos en etapa "${activeEtapa}"`}
                    onClose={() => setActiveEtapa(null)}
                  >
                    {etapaOrders.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No hay pedidos actualmente en esta etapa.
                      </p>
                    ) : (
                      <DataTable
                        columns={trackingColumns}
                        data={etapaOrders.map((e) => ({ order: e.order, timeInStatusMs: e.timeInStatusMs }))}
                      />
                    )}
                  </ChartDrillDownPanel>
                </CardContent>
              </Card>

              {/* Estancamiento: la tabla ya es su propia superficie blanca. */}
              <section className="space-y-4" aria-labelledby="pedidos-estancados">
                <div className="flex items-center gap-2.5">
                  <h2 id="pedidos-estancados" className="flex items-center gap-2 text-section-title">
                    <ShieldAlert className="h-4 w-4 text-muted-foreground" aria-hidden />
                    Pedidos estancados
                  </h2>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                      stagnantOrders.length > 0
                        ? "bg-red-500/10 text-red-700 dark:bg-red-400/10 dark:text-red-300"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {stagnantOrders.length}
                  </span>
                </div>
                {stagnantOrders.length === 0 ? (
                  <Card className="p-5 text-sm text-muted-foreground">
                    No hay pedidos estancados actualmente. Buen trabajo.
                  </Card>
                ) : (
                  <DataTable columns={stagnantColumns} data={stagnantOrders} />
                )}
              </section>

              {/* Seguimiento global */}
              <section className="space-y-4" aria-labelledby="seguimiento-global">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 id="seguimiento-global" className="flex items-center gap-2 text-section-title">
                    <ListChecks className="h-4 w-4 text-muted-foreground" aria-hidden />
                    Seguimiento global de pedidos
                  </h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-full min-w-0 rounded-full sm:w-[180px]" aria-label="Filtrar por estado">
                        <SelectValue placeholder="Filtrar por estado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los estados</SelectItem>
                        {Object.entries(statusMap).map(([id, label]) => (
                          <SelectItem key={id} value={id}>
                            {label.charAt(0).toUpperCase() + label.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="w-full min-w-0 rounded-full sm:w-[230px]" aria-label="Ordenar por">
                        <SelectValue placeholder="Ordenar por" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="timeInStatus">Tiempo en estado (mayor a menor)</SelectItem>
                        <SelectItem value="creationDate">Fecha de creación (más reciente)</SelectItem>
                        <SelectItem value="deliveryDate">Fecha de entrega (más próxima)</SelectItem>
                        <SelectItem value="status">Estado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DataTable columns={trackingColumns} data={filteredSortedOrders} />
              </section>
            </div>

            {/* Columna derecha: calendario de entregas + próximas entregas.
                En mobile va primero: es lo que se consulta al abrir la home. */}
            <div className="order-first min-w-0 space-y-6 lg:order-none">
              <DeliveryCalendar orders={orders} onSelectOrder={setOpenOrderId} />
              <UpcomingDeliveries orders={orders} onSelectOrder={setOpenOrderId} />
            </div>
          </div>
        </>
      )}

      <OrderDetailDialog orderId={openOrderId} onClose={() => setOpenOrderId(null)} />
    </div>
  );
};

export default AdminDashboardPage;
