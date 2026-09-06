"use client";

import { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { statusLabel } from "@/lib/orderStatus";

export type Order = {
  id: number;
  description: string;
  creationDate: string;
  deliveryDate?: string;
  statusId: number;
  client?: { first_name: string; last_name: string };
  user?: { firstName: string; lastName: string };
};

export const columns: ColumnDef<Order>[] = [
  {
    id: "client",
    header: "Cliente",
    cell: ({ row }) =>
      row.original.client
        ? `${row.original.client.first_name} ${row.original.client.last_name}`
        : "-",
  },
  { accessorKey: "description", header: "Descripción" },
  {
    id: "status",
    header: "Estado",
    cell: ({ row }) => statusLabel(row.original.statusId).toUpperCase(),
  },
  {
    accessorKey: "creationDate",
    header: "Fecha de Creación",
    cell: ({ row }) => new Date(row.original.creationDate).toLocaleDateString("es-MX"),
  },
  {
    accessorKey: "deliveryDate",
    header: "Fecha de Entrega",
    cell: ({ row }) =>
      row.original.deliveryDate
        ? new Date(row.original.deliveryDate).toLocaleDateString("es-MX")
        : "-",
  },
  {
    id: "actions",
    header: "Acciones",
    cell: ({ row }) => (
      <Button asChild size="icon" variant="ghost">
        <Link href={`/dashboard/orders/${row.original.id}`} aria-label="Ver detalle">
          <Eye className="h-4 w-4" />
        </Link>
      </Button>
    ),
  },
];
