import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import OrderCard from "./OrderCard";
import { statusMap } from "@/lib/orderStatus";
import type { Order } from "@/types";

/** Pedido enriquecido con el nombre de su estado (para agrupar por columna). */
export type BoardOrder = Order & { statusLabel: string };

const STATUSES = Object.values(statusMap);

const OrderStatusTable = ({ data }: { data: BoardOrder[] }) => (
  <Table>
    <TableHeader>
      <TableRow>
        {STATUSES.map((status) => (
          <TableHead key={status} className="text-center font-bold">
            {status.toUpperCase()}
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow>
        {STATUSES.map((status) => (
          <TableCell key={status} className="align-top">
            {data
              .filter((order) => order.statusLabel === status)
              .map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
          </TableCell>
        ))}
      </TableRow>
    </TableBody>
  </Table>
);

export default OrderStatusTable;
