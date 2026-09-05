"use client";

import { ColumnDef } from "@tanstack/react-table";
import { RowActions } from "@/components/crud/RowActions";
import type { CrudColumnsArgs } from "@/components/crud/CrudPage";
import type { User } from "@/types";

export const getUserColumns = ({
  onEdit,
  onDelete,
  canEdit,
}: CrudColumnsArgs<User>): ColumnDef<User>[] => [
  { accessorKey: "firstName", header: "Nombre" },
  { accessorKey: "lastName", header: "Apellido" },
  { accessorKey: "username", header: "Usuario" },
  {
    id: "roles",
    header: "Roles",
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1">
        {row.original.roles && row.original.roles.length > 0 ? (
          row.original.roles.map((r) => (
            <span
              key={r.id}
              className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
            >
              {r.name}
            </span>
          ))
        ) : (
          <span className="text-xs text-muted-foreground">Sin rol</span>
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
