"use client";

import dynamic from "next/dynamic";
import { ColumnDef } from "@tanstack/react-table";
import Title from "@/components/Title";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/data-table";
import { ErrorState } from "@/components/feedback/states";
import { ScoreBadge } from "@/components/performance/ScoreBadge";
import { usePermissions } from "@/hooks/usePermissions";
import { usePerformanceSummary } from "@/hooks/usePerformance";
import type { AreaPerformance, EmployeePerformance } from "@/types";
import { EyeOff, Gauge } from "lucide-react";

// recharts es pesado y no crítico para el primer render de la página.
const PerformanceScoreChart = dynamic(
  () => import("@/components/charts/PerformanceScoreChart"),
  { ssr: false, loading: () => <Skeleton className="h-full w-full" /> }
);

function formatHours(hours: number | null): string {
  if (hours == null) return "-";
  if (hours < 24) return `${hours.toFixed(1)} h`;
  const days = Math.floor(hours / 24);
  const rest = Math.round(hours % 24);
  return `${days}d ${rest}h`;
}

function formatRate(rate: number | null): string {
  if (rate == null) return "-";
  // El backend puede mandarlo como fracción (0-1) o como porcentaje (0-100).
  const pct = rate <= 1 ? rate * 100 : rate;
  return `${Math.round(pct)}%`;
}

function employeeName(e: EmployeePerformance): string {
  return `${e.firstName ?? ""} ${e.lastName ?? ""}`.trim() || e.username;
}

const RendimientoPage = () => {
  const { isAdmin, isSessionLoading } = usePermissions();
  const { data, isPending, isError, refetch } = usePerformanceSummary({
    enabled: isAdmin,
  });

  const employeeColumns: ColumnDef<EmployeePerformance>[] = [
    { id: "name", header: "Empleado", cell: ({ row }) => employeeName(row.original) },
    { id: "assigned", header: "Asignados", cell: ({ row }) => row.original.totalAssigned },
    { id: "completed", header: "Completados", cell: ({ row }) => row.original.totalCompleted },
    {
      id: "avgTurnaround",
      header: "Tiempo prom. de resolución",
      cell: ({ row }) => formatHours(row.original.avgTurnaroundHours),
    },
    {
      id: "onTimeRate",
      header: "% a tiempo",
      cell: ({ row }) => formatRate(row.original.onTimeRate),
    },
    {
      id: "score",
      header: "Desempeño",
      cell: ({ row }) => <ScoreBadge score={row.original.score} />,
    },
  ];

  const areaColumns: ColumnDef<AreaPerformance>[] = [
    { id: "area", header: "Área", cell: ({ row }) => row.original.area },
    { id: "assigned", header: "Asignados", cell: ({ row }) => row.original.totalAssigned },
    { id: "completed", header: "Completados", cell: ({ row }) => row.original.totalCompleted },
    {
      id: "avgTurnaround",
      header: "Tiempo prom. de resolución",
      cell: ({ row }) => formatHours(row.original.avgTurnaroundHours),
    },
    {
      id: "onTimeRate",
      header: "% a tiempo",
      cell: ({ row }) => formatRate(row.original.onTimeRate),
    },
    {
      id: "score",
      header: "Desempeño",
      cell: ({ row }) => <ScoreBadge score={row.original.score} />,
    },
  ];

  const chartData = data.areas.map((a) => ({ name: a.area, score: a.score }));

  if (!isSessionLoading && !isAdmin) {
    return (
      <div className="mt-10 rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
        No tienes permiso para ver esta página.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <Title title="Rendimiento" />
        <p className="flex items-center gap-1.5 text-muted-foreground">
          <EyeOff className="h-4 w-4 shrink-0" />
          Información sensible/interna: sólo visible para administración. Comparación de
          desempeño por empleado y por área a partir del histórico de pedidos.
        </p>
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isPending || isSessionLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      ) : (
        <>
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Empleados</h2>
            {data.employees.length === 0 ? (
              <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                Todavía no hay datos suficientes de empleados.
              </p>
            ) : (
              <div className="w-full overflow-auto">
                <DataTable columns={employeeColumns} data={data.employees} />
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Áreas</h2>
            {data.areas.length === 0 ? (
              <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                Todavía no hay datos suficientes de áreas.
              </p>
            ) : (
              <div className="w-full overflow-auto">
                <DataTable columns={areaColumns} data={data.areas} />
              </div>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Gauge className="h-5 w-5" />
                Comparación de score por área
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72 w-full">
                {chartData.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin datos para graficar.</p>
                ) : (
                  <PerformanceScoreChart data={chartData} />
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default RendimientoPage;
