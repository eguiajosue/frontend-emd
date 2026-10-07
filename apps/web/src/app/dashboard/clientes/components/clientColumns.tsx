"use client";

import { ColumnDef } from "@tanstack/react-table";
import { RowActions } from "@/components/crud/RowActions";
import type { CrudColumnsArgs } from "@/components/crud/CrudPage";
import { BranchBadge } from "@/components/orders/BranchBadge";
import type { Client } from "@/types";

export interface ClientColumnsOptions {
  /** Columna "Empresa" (la sucursal no ve las empresas globales). Default `true`. */
  showCompany?: boolean;
  /** Columna "Sucursal" con la insignia de la sucursal dueña del cliente (vista de la matriz). */
  showBranch?: boolean;
}

export const getClientColumns = (
  { onEdit, onDelete, canEdit, canDelete = true }: CrudColumnsArgs<Client>,
  { showCompany = true, showBranch = false }: ClientColumnsOptions = {}
): ColumnDef<Client>[] => [
  { accessorKey: "first_name", header: "Nombre" },
  { accessorKey: "last_name", header: "Apellido" },
  { accessorKey: "phone", header: "Teléfono" },
  { accessorKey: "email", header: "Email" },
  { accessorKey: "address", header: "Dirección" },
  ...(showCompany ? [{ accessorKey: "company.name", header: "Empresa" } as ColumnDef<Client>] : []),
  ...(showBranch
    ? [
        {
          id: "branch",
          header: "Sucursal",
          cell: ({ row }) => <BranchBadge order={row.original} />,
        } as ColumnDef<Client>,
      ]
    : []),
  {
    id: "actions",
    header: "Acciones",
    cell: ({ row }) => (
      <RowActions
        canEdit={canEdit}
        onEdit={() => onEdit(row.original)}
        onDelete={canDelete ? () => onDelete(row.original.id) : undefined}
      />
    ),
  },
];
