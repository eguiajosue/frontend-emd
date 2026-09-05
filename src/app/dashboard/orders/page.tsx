"use client";

import React from "react";
import Link from "next/link";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import Title from "@/components/Title";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Plus, FileDown } from "lucide-react";
import {
  EmptyState,
  ErrorState,
  TableSkeleton,
} from "@/components/feedback/states";
import { useEntityList } from "@/hooks/useEntity";
import { usePermissions } from "@/hooks/usePermissions";
import { statusMap } from "@/lib/orderStatus";
import { formatDate, getOrderClientName } from "@/lib/format";
import type { Order } from "@/types";
import { orderColumns } from "./components/columns";

const OrdersPage = () => {
  const { canManageOperations } = usePermissions();
  const { data, isPending, isError, refetch } = useEntityList<Order>("orders");

  const handleExport = () => {
    if (data.length === 0) {
      toast.info("No hay pedidos para exportar");
      return;
    }

    const rows = data.map((order) => ({
      ID: order.id,
      Cliente: getOrderClientName(order),
      Descripción: order.description,
      Estado: (statusMap[order.statusId] || "desconocido").toUpperCase(),
      "Fecha de Creación": formatDate(order.creationDate),
      "Fecha de Entrega": formatDate(order.deliveryDate),
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
            disabled={isPending || data.length === 0}
          >
            <FileDown className="mr-2 h-4 w-4" /> Exportar a Excel
          </Button>
          {canManageOperations && (
            <Button asChild>
              <Link href="/dashboard/orders/new">
                <Plus className="mr-2 h-4 w-4" /> Nuevo Pedido
              </Link>
            </Button>
          )}
        </div>
      </div>

      {isPending ? (
        <TableSkeleton rows={4} />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : data.length === 0 ? (
        <EmptyState message="No hay pedidos aún." />
      ) : (
        <div className="w-full overflow-auto mt-4">
          <DataTable columns={orderColumns} data={data} />
        </div>
      )}
    </div>
  );
};

export default OrdersPage;
