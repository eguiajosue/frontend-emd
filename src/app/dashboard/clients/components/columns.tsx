"use client";

import { ColumnDef } from "@tanstack/react-table";
import { RowActions } from "@/components/crud/RowActions";

export type Client = {
  id: number;
  first_name: string;
  last_name: string;
  phone?: string;
  email?: string;
  address?: string;
  companyId?: number;
  company?: { name: string };
};

interface ColumnsProps {
  onEdit: (client: Client) => void;
  onDelete: (id: number) => void;
  canEdit: boolean;
}

export const getColumns = ({ onEdit, onDelete, canEdit }: ColumnsProps): ColumnDef<Client>[] => [
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
