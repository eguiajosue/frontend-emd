"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Title from "@/components/Title";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardsSkeleton, ErrorState } from "@/components/feedback/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrders } from "@/hooks/useOrders";
import { usePermissions } from "@/hooks/usePermissions";
import { statusMap } from "@/lib/orderStatus";
import { Package, Clock, CheckCircle2, Truck } from "lucide-react";

// recharts es pesado y no crítico para el primer render del dashboard.
const OrdersByStatusBarChart = dynamic(
  () => import("@/components/charts/OrdersByStatusBarChart"),
  { ssr: false, loading: () => <Skeleton className="h-[280px] w-full" /> }
);
const OrdersByStatusPieChart = dynamic(
  () => import("@/components/charts/OrdersByStatusPieChart"),
  { ssr: false, loading: () => <Skeleton className="h-[280px] w-full" /> }
);

const Dashboard = () => {
  const router = useRouter();
  const { session, roles, isAdmin: admin, isSessionLoading } = usePermissions();

  // Los roles operativos (no admin/superuser) aterrizan en "Estatus de Pedidos" en vez
  // del dashboard de métricas generales.
  useEffect(() => {
    if (!isSessionLoading && roles.length > 0 && !admin) {
      router.replace("/dashboard/estatus-pedidos");
    }
  }, [isSessionLoading, roles, admin, router]);

  const {
    data: orders,
    isPending: loading,
    isError,
    refetch,
  } = useOrders({ enabled: admin });

  const totalOrders = orders.length;

  const statusCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    orders.forEach((order) => {
      counts[order.statusId] = (counts[order.statusId] || 0) + 1;
    });
    return counts;
  }, [orders]);

  const chartData = useMemo(
    () =>
      Object.entries(statusMap).map(([id, label]) => ({
        status: label,
        statusId: Number(id),
        total: statusCounts[Number(id)] || 0,
      })),
    [statusCounts]
  );

  const pieData = useMemo(
    () => chartData.filter((d) => d.total > 0),
    [chartData]
  );

  const pendingCount = statusCounts[1] || 0;
  const inProgressCount = (statusCounts[2] || 0) + (statusCounts[3] || 0);
  const deliveredCount = statusCounts[5] || 0;

  if (isSessionLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="w-64 h-8" />
        <CardsSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Title title="Dashboard" />
        <p className="text-muted-foreground">
          Bienvenid@, <span className="font-medium">{session?.user?.first_name}</span>
        </p>
      </div>

      {loading ? (
        <CardsSkeleton />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total de Pedidos
                </CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalOrders}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Pendientes
                </CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pendingCount}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  En Proceso
                </CardTitle>
                <Truck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{inProgressCount}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Entregados
                </CardTitle>
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{deliveredCount}</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pedidos por Estado</CardTitle>
              </CardHeader>
              <CardContent>
                {totalOrders === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No hay pedidos aún.
                  </p>
                ) : (
                  <OrdersByStatusBarChart data={chartData} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Distribución de Estados</CardTitle>
              </CardHeader>
              <CardContent>
                {pieData.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No hay pedidos aún.
                  </p>
                ) : (
                  <OrdersByStatusPieChart data={pieData} />
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
