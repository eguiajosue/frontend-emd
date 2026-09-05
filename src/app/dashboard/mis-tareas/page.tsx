"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
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
import { useCrud } from "@/hooks/useCrud";
import { authFetch, authHeaders, AuthFetchError } from "@/lib/authFetch";
import { statusMap, statusOptions } from "@/lib/orderStatus";
import { isAdminRole, statusIdsForRoles } from "@/lib/roleTaskMapping";
import { ExternalLink, ListChecks } from "lucide-react";
import { toast } from "sonner";

interface Order {
  id: number;
  clientId?: number;
  description: string;
  creationDate: string;
  deliveryDate?: string;
  statusId: number;
  client?: { first_name: string; last_name: string };
}

function getClientName(order: Order) {
  return order.client ? `${order.client.first_name} ${order.client.last_name}` : "-";
}

const MisTareasPage = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { data: orders, loading, update, fetchAll } = useCrud<Order>("orders");
  const [savingId, setSavingId] = useState<number | null>(null);

  const roles = useMemo(() => session?.user?.roles || [], [session]);
  const admin = isAdminRole(roles);
  const myStageIds = useMemo(() => statusIdsForRoles(roles), [roles]);

  const myOrders = useMemo(
    () => orders.filter((o) => myStageIds.includes(o.statusId)),
    [orders, myStageIds]
  );

  const handleQuickStatusChange = async (order: Order, newStatusId: number) => {
    if (newStatusId === order.statusId) return;
    setSavingId(order.id);
    try {
      const previousStatusId = order.statusId;
      await update(order.id, { statusId: newStatusId });
      await authFetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/order-histories`, {
        method: "POST",
        headers: authHeaders(session?.user?.token),
        body: JSON.stringify({
          orderId: order.id,
          previousStatusId,
          newStatusId,
        }),
      });
      toast.success(`Pedido #${order.id} actualizado`);
      fetchAll();
    } catch (error) {
      if (error instanceof AuthFetchError) return;
      console.error("Error al actualizar el estado:", error);
      toast.error("Ocurrió un error al actualizar el estado");
    } finally {
      setSavingId(null);
    }
  };

  const columns: ColumnDef<Order>[] = [
    { id: "id", header: "Pedido", cell: ({ row }) => `#${row.original.id}` },
    { id: "client", header: "Cliente", cell: ({ row }) => getClientName(row.original) },
    { accessorKey: "description", header: "Descripción" },
    {
      id: "status",
      header: "Estado actual",
      cell: ({ row }) => (statusMap[row.original.statusId] || "desconocido").toUpperCase(),
    },
    {
      id: "deliveryDate",
      header: "Fecha de Entrega",
      cell: ({ row }) =>
        row.original.deliveryDate
          ? new Date(row.original.deliveryDate).toLocaleDateString("es-MX")
          : "-",
    },
    {
      id: "changeStatus",
      header: "Avanzar estado",
      cell: ({ row }) => (
        <Select
          value={String(row.original.statusId)}
          onValueChange={(value) => handleQuickStatusChange(row.original, Number(value))}
        >
          <SelectTrigger className="w-[170px]" disabled={savingId === row.original.id}>
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

  if (status !== "loading" && admin) {
    return (
      <div className="mt-10 space-y-4 text-center">
        <p className="text-sm text-muted-foreground">
          Tu cuenta tiene acceso administrativo. Consulta el Panel General para la vista global.
        </p>
        <Button onClick={() => router.push("/dashboard/admin")}>Ir al Panel General</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Title title="Mis Tareas" />
        <p className="text-muted-foreground">
          Pedidos que se encuentran en la(s) etapa(s) correspondientes a tu(s) rol(es):{" "}
          <span className="font-medium">{roles.join(", ") || "sin rol asignado"}</span>
        </p>
      </div>

      {loading || status === "loading" ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : myStageIds.length === 0 ? (
        <div className="mt-6 rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
          Tu rol no tiene una etapa de pedido asignada. Contacta a un administrador.
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
