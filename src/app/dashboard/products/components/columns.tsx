"use client";

import { ColumnDef } from "@tanstack/react-table";
import { RowActions } from "@/components/crud/RowActions";

export type Product = {
  id: number;
  productTypeId: number;
  colorId?: number;
  sizeId?: number;
  code?: string;
  quantity: number;
  productType?: { name: string };
  color?: { name: string };
  size?: { name: string };
};

interface ColumnsProps {
  onEdit: (product: Product) => void;
  onDelete: (id: number) => void;
  canEdit: boolean;
}

export const getColumns = ({ onEdit, onDelete, canEdit }: ColumnsProps): ColumnDef<Product>[] => [
  { accessorKey: "code", header: "Código" },
  { accessorKey: "productType.name", header: "Tipo" },
  { accessorKey: "color.name", header: "Color" },
  { accessorKey: "size.name", header: "Tamaño" },
  { accessorKey: "quantity", header: "Cantidad" },
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
