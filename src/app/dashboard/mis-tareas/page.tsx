"use client";

import { useMemo } from "react";
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
import { statusOptions } from "@/lib/orderStatus";
import { StatusBadge } from "@/components/StatusBadge";
import { statusIdsForRoles } from "@/lib/roleTaskMapping";
import { formatDate, getOrderClientName } from "@/lib/format";
import type { Order } from "@/types";
import { ExternalLink, ListChecks } from "lucide-react";

const MisTareasPage = () => {
  const router = useRouter();
  const { roles, isAdmin, isSessionLoading } = usePermissions();
  const { data: orders, isPending, isError, refetch } = useOrders();
  const { changeStatus, changingOrderId } = useChangeOrderStatus();

  const myStageIds = useMemo(() => statusIdsForRoles(roles), [roles]);

  const myOrders = useMemo(
    () => orders.filter((o) => myStageIds.includes(o.statusId)),
    [orders, myStageIds]
  );

  const columns: ColumnDef<Order>[] = [
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
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/dashboard/orders/${row.original.id}`} aria-label="Ver detalle">
            <ExternalLink className="h-4 w-4" />
          </Link>
        </Button>
      ),
    },
  ];

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
      <div>
        <Title title="Mis Tareas" />
        <p className="text-muted-foreground">
          Pedidos que se encuentran en la(s) etapa(s) correspondientes a tu(s)
          rol(es):{" "}
          <span className="font-medium">
            {roles.join(", ") || "sin rol asignado"}
          </span>
        </p>
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
      ) : (
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
                <DataTable columns={columns} data={myOrders} />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MisTareasPage;
