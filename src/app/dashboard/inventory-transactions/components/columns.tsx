"use client";

import { ColumnDef } from "@tanstack/react-table";
import { RowActions } from "@/components/crud/RowActions";

export type InventoryTransaction = {
  id: number;
  productId: number;
  quantityChange: number;
  transactionDate?: string;
  notes?: string;
  product?: { code?: string; productType?: { name: string } };
};

interface ColumnsProps {
  onEdit: (transaction: InventoryTransaction) => void;
  onDelete: (id: number) => void;
  canEdit: boolean;
}

export const getColumns = ({ onEdit, onDelete, canEdit }: ColumnsProps): ColumnDef<InventoryTransaction>[] => [
  {
    accessorKey: "product.code",
    header: "Producto",
    cell: ({ row }) =>
      row.original.product?.code ||
      row.original.product?.productType?.name ||
      row.original.productId,
  },
  {
    accessorKey: "quantityChange",
    header: "Cambio",
    cell: ({ row }) => {
      const value = row.original.quantityChange;
      return (
        <span className={value >= 0 ? "text-green-600" : "text-red-600"}>
          {value >= 0 ? `+${value}` : value}
        </span>
      );
    },
  },
  {
    accessorKey: "transactionDate",
    header: "Fecha",
    cell: ({ row }) =>
      row.original.transactionDate
        ? new Date(row.original.transactionDate).toLocaleDateString("es-MX")
        : "-",
  },
  { accessorKey: "notes", header: "Notas" },
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
