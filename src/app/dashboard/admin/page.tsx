"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Title from "@/components/Title";
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
import { formatDate, getClientName, getUserName } from "@/lib/format";
import type { Order, OrderHistory } from "@/types";
import { AlertTriangle, ShieldAlert, ListChecks, Gauge } from "lucide-react";

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

const AdminDashboardPage = () => {
  const { roles, isAdmin, isSessionLoading } = usePermissions();
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
      cell: ({ row }) =>
        (statusMap[row.original.order.statusId] || "desconocido").toUpperCase(),
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
        formatDate(row.original.order.deliveryDate),
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
    <div className="space-y-8">
      <div>
        <Title title="Panel General" />
        <p className="text-muted-foreground">
          Vista global de todos los pedidos, detección de estancamiento y rendimiento por área.
        </p>
      </div>

      {hasError ? (
        <ErrorState
          onRetry={() => {
            refetchOrders();
            refetchHistories();
          }}
        />
      ) : loading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
          No hay pedidos aún.
        </div>
      ) : (
        <>
          {/* Sección 2: Estancamiento (arriba para que se vea de inmediato) */}
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

          {/* Sección 3: Rendimiento por área/etapa */}
          <div className="space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Gauge className="h-5 w-5" />
              Rendimiento por área/etapa
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {performanceByStatus.map((p) => (
                <Card key={p.statusId}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {p.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    <div className="text-2xl font-bold">{p.currentCount}</div>
                    <p className="text-xs text-muted-foreground">pedidos en esta etapa</p>
                    <p className="text-xs">
                      Prom. histórico:{" "}
                      <span className="font-medium">
                        {p.avgMs != null ? formatDuration(p.avgMs) : "sin datos"}
                      </span>
                      {p.samples > 0 && p.samples < MIN_SAMPLES_FOR_AVERAGE && (
                        <span className="text-muted-foreground"> (poca muestra)</span>
                      )}
                    </p>
                    <p className="text-xs">
                      Estancados:{" "}
                      <span className={p.stagnantCount > 0 ? "font-medium text-red-600" : "font-medium"}>
                        {p.stagnantCount}
                      </span>
                    </p>
                    <p className="text-xs">
                      % a tiempo:{" "}
                      <span className="font-medium">
                        {p.onTimePct != null ? `${p.onTimePct}%` : "-"}
                      </span>
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tiempo promedio por etapa (horas)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="etapa" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="horasPromedio" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sección 1: Seguimiento global */}
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
        </>
      )}
    </div>
  );
};

export default AdminDashboardPage;
