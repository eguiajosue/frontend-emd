"use client";

import { ColumnDef } from "@tanstack/react-table";
import { RowActions } from "@/components/crud/RowActions";
import type { CrudColumnsArgs } from "@/components/crud/CrudPage";
import { LOCATION_LABELS } from "@/lib/suppliers";
import type { Supplier } from "@/types";

export const getSupplierColumns = ({
  onEdit,
  onDelete,
  canEdit,
}: CrudColumnsArgs<Supplier>): ColumnDef<Supplier>[] => [
  { accessorKey: "name", header: "Nombre" },
  { accessorKey: "email", header: "Email" },
  { accessorKey: "phone", header: "Teléfono" },
  { accessorKey: "website", header: "Web" },
  {
    accessorKey: "location",
    header: "Ubicación",
    cell: ({ row }) => LOCATION_LABELS[row.original.location] ?? row.original.location,
  },
  {
    id: "actions",
    header: "Acciones",
    cell: ({ row }) => (
      <RowActions
        canEdit={canEdit}
        onEdit={() => onEdit(row.original)}
        onDelete={() => onDelete(row.original.id)}
      />
    ),
  },
];
