"use client";

import React, { useMemo } from "react";
import Title from "@/components/Title";
import OrderStatusTable from "./components/OrderStatusTable";
import { ErrorState, TableSkeleton } from "@/components/feedback/states";
import { useOrders } from "@/hooks/useOrders";
import { statusMap } from "@/lib/orderStatus";

const OrderStatus = () => {
  const { data, isPending, isError, refetch } = useOrders();

  // El backend devuelve `statusId`; el tablero agrupa por el nombre del estado.
  const boardOrders = useMemo(
    () =>
      data.map((order) => ({
        ...order,
        statusLabel: statusMap[order.statusId] || "desconocido",
      })),
    [data]
  );

  return (
    <div className="p-6">
      <Title title="Estatus de Ordenes" />
      {isPending ? (
        <TableSkeleton rows={3} />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <OrderStatusTable data={boardOrders} />
      )}
    </div>
  );
};

export default OrderStatus;
