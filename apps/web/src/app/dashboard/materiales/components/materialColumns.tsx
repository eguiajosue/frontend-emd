"use client";

import { ColumnDef } from "@tanstack/react-table";
import { RowActions } from "@/components/crud/RowActions";
import type { CrudColumnsArgs } from "@/components/crud/CrudPage";
import { getAreaLabel } from "@/lib/areas";
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
            <span
              key={area}
              className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide"
            >
              {getAreaLabel(area)}
            </span>
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
