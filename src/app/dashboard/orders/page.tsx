"use client";

import React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import Title from "@/components/Title";
import { DataTable } from "@/components/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Plus, FileDown } from "lucide-react";
import { useCrud } from "@/hooks/useCrud";
import { statusMap } from "@/lib/orderStatus";
import { columns, Order } from "./components/columns";

const OrdersPage = () => {
  const { data: session } = useSession();
  const { data, loading } = useCrud<Order>("orders");

  const role = session?.user?.role;
  const canCreate = role === "admin" || role === "recepcion";

  const handleExport = () => {
    if (data.length === 0) {
      toast.info("No hay pedidos para exportar");
      return;
    }

    const rows = data.map((order) => ({
      ID: order.id,
      Cliente: order.client
        ? `${order.client.first_name} ${order.client.last_name}`
        : "-",
      Descripción: order.description,
      Estado: (statusMap[order.statusId] || "desconocido").toUpperCase(),
      "Fecha de Creación": order.creationDate
        ? new Date(order.creationDate).toLocaleDateString("es-MX")
        : "-",
      "Fecha de Entrega": order.deliveryDate
        ? new Date(order.deliveryDate).toLocaleDateString("es-MX")
        : "-",
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Pedidos");

    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `pedidos-${today}.xlsx`);
  };

  return (
    <div className="p-0 w-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Title title="Lista de Pedidos" />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={loading || data.length === 0}
          >
            <FileDown className="mr-2 h-4 w-4" /> Exportar a Excel
          </Button>
          {canCreate && (
            <Button asChild>
              <Link href="/dashboard/orders/new">
                <Plus className="mr-2 h-4 w-4" /> Nuevo Pedido
              </Link>
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-4 mt-4">
          <Skeleton className="w-full h-10" />
          <Skeleton className="w-full h-10" />
          <Skeleton className="w-full h-10" />
        </div>
      ) : data.length === 0 ? (
        <div className="mt-6 rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
          No hay pedidos aún.
        </div>
      ) : (
        <div className="w-full overflow-auto mt-4">
          <DataTable columns={columns} data={data} />
        </div>
      )}
    </div>
  );
};

export default OrdersPage;
