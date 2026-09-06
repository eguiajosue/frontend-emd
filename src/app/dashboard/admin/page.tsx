"use client";

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
import type { Order, OrderHistory } from "@/types";
import { AlertTriangle, ShieldAlert, ListChecks, Gauge, TrendingUp, LayoutDashboard } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { GreetingHeader } from "@/components/admin/GreetingHeader";
import { DeliveryCalendar } from "@/components/admin/DeliveryCalendar";
import { UpcomingDeliveries } from "@/components/admin/UpcomingDeliveries";
import { OrderDetailDialog } from "@/components/orders/OrderDetailDialog";
import { ProgressRing } from "@/components/ui/progress-ring";
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

// recharts es pesado y no crítico para el primer render del panel admin.
const AvgTimeBarChart = dynamic(() => import("@/components/charts/AvgTimeBarChart"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

const AdminDashboardPage = () => {
  const { roles, isAdmin, isSessionLoading, session } = usePermissions();
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
        label: label.toUpperCase(),
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
    { id: "id", header: "ID", cell: ({ row }) => `#${row.original.order.id}` },
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
      cell: ({ row }) => <StatusBadge statusId={row.original.order.statusId} />,
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
        formatDeliveryDate(row.original.order.deliveryDate),
    },
    {
      id: "timeInStatus",
      header: "Tiempo en estado actual",
      cell: ({ row }) => {
        const isStagnant = stagnantOrderIds.has(row.original.order.id);
        return (
          <span
            className={
              isStagnant
                ? "inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300"
                : "text-sm"
            }
          >
            {isStagnant && <AlertTriangle className="h-3 w-3" />}
            {formatDuration(row.original.timeInStatusMs)}
          </span>
        );
      },
    },
  ];

  const stagnantColumns: ColumnDef<(typeof stagnantOrders)[number]>[] = [
    { id: "id", header: "Pedido", cell: ({ row }) => `#${row.original.order.id}` },
    {
      id: "client",
      header: "Cliente",
      cell: ({ row }) => getClientName(row.original.order.client),
    },
    {
      id: "status",
      header: "Estado",
      cell: ({ row }) => (
        <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-800 dark:bg-orange-950 dark:text-orange-300">
          {(statusMap[row.original.order.statusId] || "desconocido").toUpperCase()}
        </span>
      ),
    },
    {
      id: "timeInStatus",
      header: "Tiempo estancado",
      cell: ({ row }) => (
        <span className="font-semibold text-red-700 dark:text-red-400">
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
      <div className="mt-10 rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
        No tienes permiso para ver esta página.
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <GreetingHeader firstName={session?.user?.first_name} />

      <div className="flex justify-end">
        <Button variant="outline" className="gap-2 shrink-0" asChild>
          <a href="/dashboard/admin/rendimiento">
            <TrendingUp className="h-4 w-4" />
            Ver rendimiento de empleados y áreas
          </a>
        </Button>
      </div>

      {hasError ? (
        <ErrorState
          onRetry={() => {
            refetchOrders();
            refetchHistories();
          }}
        />
      ) : loading ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={LayoutDashboard}
          title="El panel está esperando su primer pedido"
          description="Las métricas de rendimiento, tiempos por etapa y alertas van a aparecer acá apenas se cargue el primero."
        />
      ) : (
        <div className="grid gap-10 lg:grid-cols-3 lg:items-start">
        <div className="space-y-10 lg:col-span-2">
          {/* Bento grid de KPIs: la caja de score global es la más grande y
              lleva el número más importante del panel; el resto son cajas
              1x1 por etapa. En mobile colapsa a una columna en orden de
              importancia (score global primero). */}
          <div className="space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Gauge className="h-5 w-5" />
              Rendimiento por área/etapa
            </h2>
            <motion.div
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
              variants={staggerContainerVariants}
              initial="hidden"
              animate="show"
            >
              {/* Hero tile: score global de rendimiento */}
              <motion.div
                variants={staggerItemVariants}
                className="order-1 sm:col-span-2 lg:col-span-2 lg:row-span-2"
              >
                <Card className="flex h-full flex-col justify-between p-8">
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-sm font-medium text-muted-foreground">
                      Score de rendimiento general
                    </p>
                    <ProgressRing
                      value={overallScore.onTimePct ?? 0}
                      size={56}
                      strokeWidth={5}
                      label={overallScore.onTimePct != null ? `${overallScore.onTimePct}%` : "-"}
                      className={cn(
                        overallScore.onTimePct == null
                          ? "text-muted-foreground"
                          : overallScore.onTimePct >= 80
                          ? "text-emerald-600 dark:text-emerald-400"
                          : overallScore.onTimePct >= 50
                          ? "text-amber-500"
                          : "text-red-600 dark:text-red-400"
                      )}
                    />
                  </div>
                  <div className="mt-6">
                    <div className="text-6xl font-black leading-none tracking-tighter tabular-nums md:text-7xl">
                      {overallScore.onTimePct != null ? `${overallScore.onTimePct}%` : "—"}
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      de {overallScore.totalActive} pedidos activos a tiempo
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
                    </p>
                  </div>
                </Card>
              </motion.div>

              {performanceByStatus.map((p, idx) => (
                <motion.div
                  key={p.statusId}
                  variants={staggerItemVariants}
                  className={cn("order-2", idx === 0 && "order-2")}
                >
                  <Card className="flex h-full flex-col justify-between p-6">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {p.label}
                      </p>
                      <ProgressRing
                        value={p.onTimePct ?? 0}
                        size={36}
                        strokeWidth={4}
                        label={p.onTimePct != null ? `${p.onTimePct}%` : "-"}
                        className={cn(
                          p.onTimePct == null
                            ? "text-muted-foreground"
                            : p.onTimePct >= 80
                            ? "text-emerald-600 dark:text-emerald-400"
                            : p.onTimePct >= 50
                            ? "text-amber-500"
                            : "text-red-600 dark:text-red-400"
                        )}
                      />
                    </div>
                    <div className="mt-4">
                      <div className="text-4xl font-black leading-none tracking-tight tabular-nums">
                        {p.currentCount}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">pedidos en esta etapa</p>
                    </div>
                    <div className="mt-4 space-y-1 text-xs">
                      <p>
                        Prom. histórico:{" "}
                        <span className="font-medium">
                          {p.avgMs != null ? formatDuration(p.avgMs) : "sin datos"}
                        </span>
                        {p.samples > 0 && p.samples < MIN_SAMPLES_FOR_AVERAGE && (
                          <span className="text-muted-foreground"> (poca muestra)</span>
                        )}
                      </p>
                      <p>
                        Estancados:{" "}
                        <span className={p.stagnantCount > 0 ? "font-medium text-red-600" : "font-medium"}>
                          {p.stagnantCount}
                        </span>
                      </p>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </motion.div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tiempo promedio por etapa (horas)</CardTitle>
                {slowestStageInsight && (
                  <p className="text-sm text-muted-foreground">
                    La etapa{" "}
                    <span className="font-medium text-foreground">{slowestStageInsight.label}</span>{" "}
                    es la que más tiempo promedio toma (
                    {formatDuration(slowestStageInsight.avgMs!)}).
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
                    <div className="w-full overflow-auto">
                      <DataTable
                        columns={trackingColumns}
                        data={etapaOrders.map((e) => ({ order: e.order, timeInStatusMs: e.timeInStatusMs }))}
                      />
                    </div>
                  )}
                </ChartDrillDownPanel>
              </CardContent>
            </Card>
          </div>

          {/* Estancamiento */}
          <Card
            className={
              stagnantOrders.length > 0
                ? "border-red-300 dark:border-red-900"
                : undefined
            }
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldAlert className="h-5 w-5 text-red-600" />
                Pedidos estancados
              </CardTitle>
              <span
                className={
                  stagnantOrders.length > 0
                    ? "rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white"
                    : "rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
                }
              >
                {stagnantOrders.length}
              </span>
            </CardHeader>
            <CardContent>
              {stagnantOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay pedidos estancados actualmente. Buen trabajo.
                </p>
              ) : (
                <div className="w-full overflow-auto">
                  <DataTable columns={stagnantColumns} data={stagnantOrders} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Seguimiento global */}
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <ListChecks className="h-5 w-5" />
                Seguimiento global de pedidos
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filtrar por estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    {Object.entries(statusMap).map(([id, label]) => (
                      <SelectItem key={id} value={id}>
                        {label.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[220px]">
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
            <div className="w-full overflow-auto">
              <DataTable columns={trackingColumns} data={filteredSortedOrders} />
            </div>
          </div>
        </div>

        {/* Columna derecha: calendario de entregas + próximas entregas */}
        <div className="space-y-10">
          <DeliveryCalendar orders={orders} onSelectOrder={setOpenOrderId} />
          <UpcomingDeliveries orders={orders} onSelectOrder={setOpenOrderId} />
        </div>
        </div>
      )}

      <OrderDetailDialog orderId={openOrderId} onClose={() => setOpenOrderId(null)} />
    </div>
  );
};

export default AdminDashboardPage;
