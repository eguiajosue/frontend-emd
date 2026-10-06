"use client";

import { ColumnDef } from "@tanstack/react-table";
import { RowActions } from "@/components/crud/RowActions";
import type { CrudColumnsArgs } from "@/components/crud/CrudPage";
import type { Client } from "@/types";

export const getClientColumns = ({
  onEdit,
  onDelete,
  canEdit,
}: CrudColumnsArgs<Client>): ColumnDef<Client>[] => [
  { accessorKey: "first_name", header: "Nombre" },
  { accessorKey: "last_name", header: "Apellido" },
  { accessorKey: "phone", header: "Teléfono" },
  { accessorKey: "email", header: "Email" },
  { accessorKey: "address", header: "Dirección" },
  { accessorKey: "company.name", header: "Empresa" },
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
