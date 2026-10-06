"use client";

import { Badge } from "@/components/ui/badge";
import { ColumnDef } from "@tanstack/react-table";
import { RowActions } from "@/components/crud/RowActions";
import type { CrudColumnsArgs } from "@/components/crud/CrudPage";
import { getAreaLabel } from "@/lib/areas";
import { formatCurrencyMXN } from "@/lib/format";
import type { Material } from "@/types";

export const getMaterialColumns = ({
  onEdit,
  onDelete,
  canEdit,
}: CrudColumnsArgs<Material>): ColumnDef<Material>[] => [
  { accessorKey: "name", header: "Material" },
  {
    id: "category",
    header: "Categoría",
    cell: ({ row }) => row.original.category?.name ?? "—",
  },
  {
    id: "unit",
    header: "Unidad",
    cell: ({ row }) => row.original.unit?.name ?? "—",
  },
  { accessorKey: "measure", header: "Medida" },
  { accessorKey: "color", header: "Color" },
  { accessorKey: "brand", header: "Marca" },
  {
    id: "suggestedPrice",
    header: "Precio sugerido",
    cell: ({ row }) =>
      row.original.suggestedPrice != null ? formatCurrencyMXN(row.original.suggestedPrice) : "—",
  },
  {
    id: "supplier",
    header: "Proveedor",
    cell: ({ row }) => row.original.supplier?.name ?? "—",
  },
  {
    id: "areas",
    header: "Áreas",
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1">
        {row.original.areas.length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          row.original.areas.map((area) => (
            <Badge key={area} variant="muted" className="px-2">
              {getAreaLabel(area)}
            </Badge>
          ))
        )}
      </div>
    ),
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
