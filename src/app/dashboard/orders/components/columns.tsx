"use client";

import { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate } from "@/lib/format";
import type { Order } from "@/types";

export const orderColumns: ColumnDef<Order>[] = [
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
    cell: ({ row }) => <StatusBadge statusId={row.original.statusId} />,
  },
  {
    accessorKey: "creationDate",
    header: "Fecha de Creación",
    cell: ({ row }) => formatDate(row.original.creationDate),
  },
  {
    accessorKey: "deliveryDate",
    header: "Fecha de Entrega",
    cell: ({ row }) => formatDate(row.original.deliveryDate),
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
