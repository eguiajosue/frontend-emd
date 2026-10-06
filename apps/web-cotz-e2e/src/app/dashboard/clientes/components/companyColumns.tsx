"use client";

import { ColumnDef } from "@tanstack/react-table";
import { RowActions } from "@/components/crud/RowActions";
import type { CrudColumnsArgs } from "@/components/crud/CrudPage";
import type { Company } from "@/types";

export const getCompanyColumns = ({
  onEdit,
  onDelete,
  canEdit,
}: CrudColumnsArgs<Company>): ColumnDef<Company>[] => [
  { accessorKey: "name", header: "Nombre" },
  { accessorKey: "phone", header: "Teléfono" },
  { accessorKey: "email", header: "Email" },
  { accessorKey: "address", header: "Dirección" },
  { accessorKey: "location", header: "Ubicación" },
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
