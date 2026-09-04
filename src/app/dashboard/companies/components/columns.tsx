"use client";

import { ColumnDef } from "@tanstack/react-table";
import { RowActions } from "@/components/crud/RowActions";

export type Company = {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  location?: string;
};

interface ColumnsProps {
  onEdit: (company: Company) => void;
  onDelete: (id: number) => void;
  canEdit: boolean;
}

export const getColumns = ({ onEdit, onDelete, canEdit }: ColumnsProps): ColumnDef<Company>[] => [
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
