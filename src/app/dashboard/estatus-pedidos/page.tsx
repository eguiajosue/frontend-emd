"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Title from "@/components/Title";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
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
import { useChangeOrderStatus, useOrders } from "@/hooks/useOrders";
import { usePermissions } from "@/hooks/usePermissions";
import { statusMap, statusOptions } from "@/lib/orderStatus";
import { StatusBadge } from "@/components/StatusBadge";
import { statusIdsForRoles } from "@/lib/roleTaskMapping";
import { formatDate, getOrderClientName } from "@/lib/format";
import { OrderCard } from "@/components/orders/OrderCard";
import { OrderDetailDialog } from "@/components/orders/OrderDetailDialog";
import type { Order } from "@/types";
import { ExternalLink, LayoutGrid, List, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";

const VIEW_MODE_KEY = "estatus-pedidos-view-mode";
type ViewMode = "list" | "grid";

const EstatusPedidosPage = () => {
  const router = useRouter();
  const { roles, isAdmin, isSessionLoading } = usePermissions();
  const { data: orders, isPending, isError, refetch } = useOrders();
  const { changeStatus, changingOrderId } = useChangeOrderStatus();

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [openOrderId, setOpenOrderId] = useState<number | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(VIEW_MODE_KEY);
      if (stored === "list" || stored === "grid") setViewMode(stored);
    } catch {
      // Sin acceso a localStorage (modo privado, etc.): se queda en "list".
    }
  }, []);

  const updateViewMode = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(VIEW_MODE_KEY, mode);
    } catch {
      // No pasa nada si no se puede persistir.
    }
  }, []);

  const openDetail = useCallback((id: number) => setOpenOrderId(id), []);
  const closeDetail = useCallback(() => setOpenOrderId(null), []);

  const myStageIds = useMemo(() => statusIdsForRoles(roles), [roles]);

  const myOrders = useMemo(
    () => orders.filter((o) => myStageIds.includes(o.statusId)),
    [orders, myStageIds]
  );

  const columns: ColumnDef<Order>[] = useMemo(
    () => [
      { id: "id", header: "Pedido", cell: ({ row }) => `#${row.original.id}` },
      {
        id: "client",
        header: "Cliente",
        cell: ({ row }) => getOrderClientName(row.original),
      },
      { accessorKey: "description", header: "Descripción" },
      {
        id: "status",
        header: "Estado actual",
        cell: ({ row }) => <StatusBadge statusId={row.original.statusId} />,
      },
      {
        id: "deliveryDate",
        header: "Fecha de Entrega",
        cell: ({ row }) => formatDate(row.original.deliveryDate),
      },
      {
        id: "changeStatus",
        header: "Avanzar estado",
        cell: ({ row }) => (
          <Select
            value={String(row.original.statusId)}
            onValueChange={(value) => {
              const next = Number(value);
              if (next !== row.original.statusId) {
                changeStatus(row.original, next);
              }
            }}
          >
            <SelectTrigger
              className="w-[170px]"
              onClick={(e) => e.stopPropagation()}
              disabled={changingOrderId === row.original.id}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((opt) => (
                <SelectItem key={opt.value} value={String(opt.value)}>
                  {opt.label.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="icon"
            asChild
            onClick={(e) => e.stopPropagation()}
          >
            <Link href={`/dashboard/orders/${row.original.id}`} aria-label="Ver pedido completo">
              <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>
        ),
      },
    ],
    [changeStatus, changingOrderId]
  );

  // Columnas de la vista cuadrícula: una por cada etapa del flujo que le
  // corresponde al rol del usuario (statusMap trae el nombre "oficial" de cada una).
  const gridColumns = useMemo(() => {
    const stageIds = myStageIds.length > 0 ? myStageIds : Object.keys(statusMap).map(Number);
    return stageIds
      .slice()
      .sort((a, b) => a - b)
      .map((statusId) => ({
        statusId,
        label: statusMap[statusId] ?? `Estado ${statusId}`,
        orders: myOrders.filter((o) => o.statusId === statusId),
      }));
  }, [myStageIds, myOrders]);

  if (!isSessionLoading && isAdmin) {
    return (
      <div className="mt-10 space-y-4 text-center">
        <p className="text-sm text-muted-foreground">
          Tu cuenta tiene acceso administrativo. Consulta el Panel General para la
          vista global.
        </p>
        <Button onClick={() => router.push("/dashboard/admin")}>
          Ir al Panel General
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Title title="Estatus de Pedidos" />
          <p className="text-muted-foreground">
            Pedidos que se encuentran en la(s) etapa(s) correspondientes a tu(s)
            rol(es):{" "}
            <span className="font-medium">
              {roles.join(", ") || "sin rol asignado"}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-md border p-1">
          <Button
            type="button"
            size="sm"
            variant={viewMode === "list" ? "default" : "ghost"}
            className="gap-1.5"
            onClick={() => updateViewMode("list")}
          >
            <List className="h-4 w-4" /> Lista
          </Button>
          <Button
            type="button"
            size="sm"
            variant={viewMode === "grid" ? "default" : "ghost"}
            className="gap-1.5"
            onClick={() => updateViewMode("grid")}
          >
            <LayoutGrid className="h-4 w-4" /> Cuadrícula
          </Button>
        </div>
      </div>

      {isPending || isSessionLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : myStageIds.length === 0 ? (
        <div className="mt-6 rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
          Tu rol no tiene una etapa de pedido asignada. Contacta a un
          administrador.
        </div>
      ) : viewMode === "list" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ListChecks className="h-5 w-5" />
              Pedidos pendientes en tu(s) etapa(s) ({myOrders.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {myOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No tienes pedidos pendientes en este momento. Buen trabajo.
              </p>
            ) : (
              <div className="w-full overflow-auto">
                <DataTable columns={columns} data={myOrders} onRowClick={(o) => openDetail(o.id)} />
              </div>
            )}
          </CardContent>
        </Card>
      ) : myOrders.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No tienes pedidos pendientes en este momento. Buen trabajo.
        </p>
      ) : (
        <div
          className={cn(
            "grid gap-4",
            gridColumns.length <= 1 && "sm:grid-cols-1",
            gridColumns.length === 2 && "sm:grid-cols-2",
            gridColumns.length >= 3 && "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          )}
        >
          {gridColumns.map((col) => (
            <div key={col.statusId} className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {col.label}
                </h3>
                <span className="text-xs text-muted-foreground">{col.orders.length}</span>
              </div>
              <div className="space-y-3">
                {col.orders.length === 0 ? (
                  <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                    Sin pedidos
                  </p>
                ) : (
                  col.orders.map((order) => (
                    <OrderCard key={order.id} order={order} onOpen={openDetail} />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <OrderDetailDialog orderId={openOrderId} onClose={closeDetail} />
    </div>
  );
};

export default EstatusPedidosPage;
